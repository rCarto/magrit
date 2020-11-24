#!/usr/bin/env python3.6
# -*- coding: utf-8 -*-
import re
import numpy as np
import ujson as json
import cchardet as chardet
import tempfile
from fiona import _err as fiona_err
from osgeo.ogr import GetDriverByName, Feature as OgrFeature
from osgeo.osr import SpatialReference, CoordinateTransformation
from osgeo.gdal import VectorTranslate, OpenEx, UseExceptions as gdal_UseExceptions
from pyproj import Proj as pyproj_Proj
from shapely.geos import TopologicalError
from shapely.geometry import shape, mapping, MultiPolygon
from shapely.affinity import scale
from os.path import exists, join as path_join
from pandas import read_json as pd_read_json
from geopandas import GeoDataFrame
from struct import unpack
from subprocess import Popen, PIPE
from .cartogram_doug import make_cartogram


def _compute_centroids(geometries, argmax=np.argmax):
    res = []
    for geom in geometries:
        if hasattr(geom, '__len__'):
            ix_biggest = argmax([g.area for g in geom])
            res.append(geom[ix_biggest].centroid)
        else:
            res.append(geom.centroid)
    return res


def get_proj4_string(wkt_proj):
    if not wkt_proj:
        return None
    else:
        a = SpatialReference(wkt_proj)
        a.MorphFromESRI()
        res = a.ExportToProj4()
        return None if \
            '+proj=longlat +ellps=WGS84 +no_defs' in res \
            or '+proj=longlat +datum=WGS84 +no_defs' in res \
            else res


def read_shp_crs(path):
    """
    Read the .prj file given with a shapefile.

    Parameters
    ----------
    path: str
        Path to the .prj file to be readed.

    Returns
    -------
    esriwktproj: str
        The projection in ESRI WKT format.
    """
    with open(path, 'r') as f:
        proj_info_str = f.read()
    return proj_info_str


def get_field_names(srcDS):
    """
    Sanitize field names if necessary (if containing whitespace for example)
    by replacing them on the returned GeoJSON.

    Parameters
    ----------
    srcDS: gdal.Dataset
        The dataset object, before conversion, used to fetch the name of each field
        and decide if it needs to be sanitized.

    Returns
    -------
    result: list of dict
        An empty list if there is no field name to be changed, or a list of
        dict (each one like {"old": "b@d name", "new": "b_d_name"}).
    """
    regex_field_name = re.compile("[^a-zA-Z0-9_-ëêàáâãæêéèñòóô]+")
    layer = srcDS.GetLayer()
    layer_defn = layer.GetLayerDefn()
    names = []
    for i in range(layer_defn.GetFieldCount()):
        fieldDefn = layer_defn.GetFieldDefn(i)
        col_name = fieldDefn.GetNameRef()
        new_col_name = regex_field_name.sub('_', col_name)
        if not col_name == new_col_name:
            names.append({
                "old": col_name.encode(),
                "new": new_col_name.encode()
            })
    return names


def get_encoding_dbf(file_path):
    with open(file_path, 'rb') as f:
        nb_records, len_header = unpack('<xxxxLH22x', f.read(32))
        f.seek(len_header)
        encoding = chardet.detect(f.read())
    return encoding['encoding']


def replace_field_names(raw_geojson, fields_map):
    """
    Sanitize field names if necessary (if containing whitespace for example)
    by replacing them on the returned GeoJSON.

    Parameters
    ----------
    raw_geojson: bytes
        The GeoJSON FeatureCollection on which operate
        (as bytes, encoded in UTF-8)
    fields_map: list of dict
        A list of dict, each one containing informations about a field name
        to be replaced.

    Returns
    -------
    result: bytes
        The resulting GeoJSON FeatureCollection.
    """
    print('Replacing field names')
    nb_elem = raw_geojson.count(b'\"type\": \"Feature\"')
    for o in fields_map:
        old_field_name = b''.join([b' \"', o['old'], b'\":'])
        if raw_geojson.count(old_field_name) != nb_elem:
            continue
        raw_geojson = raw_geojson.replace(
            old_field_name, b''.join([b' \"', o['new'], b'\":']))
    return raw_geojson


def ogr_to_geojson(file_path):
    """
    Convert the input layer to GeoJSON.

    Entry point to convert a layer (in a format supported by ogr) to a GeoJSON layer.
    This function takes care of creating a .cpg file if it is missing and if the
    encoding doesn't seems to be ISO-8859-1 or UTF-8; it also takes care
    of sanitizing field names (against whitespace for example).
    The conversion is handled by gdal.VectorTranslate function (with 'skipfailure' option),
    with a fallback on python OGR bindings (trying to handle to conversion anyway,
    by skipping problematic geometry/feature too).

    Parameters
    ----------
    file_path: str
        Path of the input file.

    Returns
    -------
    raw_geojson: bytes
        The resulting GeoJSON FeatureCollection.
    """
    if 'kml' in file_path:
        file_format = "KML"
    elif 'gml' in file_path:
        file_format = "GML"
    elif 'geojson' in file_path:
        file_format = "GeoJSON"
    elif 'shp' in file_path:
        file_format = "ESRI ShapeFile"
    else:
        return None

    if file_format == "ESRI ShapeFile" \
            and not exists(file_path.replace('.shp', '.cpg')):
        file_path_cpg = file_path.replace('.shp', '.cpg')
        encoding = get_encoding_dbf(file_path.replace('.shp', '.dbf'))
        if encoding:
            with open(file_path_cpg, 'wb') as f:
                f.write(encoding.encode())

    elif file_format == "GeoJSON":
        with open(file_path, 'rb') as f:
            raw_content = f.read()
        encoding = chardet.detect(raw_content)
        if encoding['encoding'] is not 'UTF-8':
            content = raw_content.decode(encoding['encoding'])
            with open(file_path, 'wb') as f:
                f.write(content.encode())

    result = vectorTranslate_to_geojson(file_path)
    if result:
        print('Conversion Successful with VectorTranslate')
        return result

    try:
        result = convert_ogr_to_geojson(file_path, file_format)
    except Exception as err:
        print(err)
        result = None
    return result


def vectorTranslate_to_geojson(file_path):
    """
    Convert a layer (in a format supported by ogr) to a GeoJSON layer.

    Parameters
    ----------
    file_path: str
        Path of the input file.

    Returns
    -------
    raw_geojson: bytes
        The resulting GeoJSON FeatureCollection.
    """
    try:
        with tempfile.TemporaryDirectory() as tmpdirname:
            gdal_UseExceptions()
            srcDS = OpenEx(file_path)
            field_names_to_replace = get_field_names(srcDS)
            ds = VectorTranslate(
                path_join(tmpdirname, 'result.geojson'),
                srcDS=srcDS,
                format='GeoJSON',
                dstSRS='EPSG:4326',
                skipFailures=True,
                layerCreationOptions=[
                    'WRITE_BBOX=YES',
                    'WRITE_NAME=NO',
                    'SIGNIFICANT_FIGURES=20',
                    'COORDINATE_PRECISION=15',
                ])
            if not ds:
                return
            p = ds.GetDescription()
            del ds
            with open(p, 'rb') as f:
                result = f.read()
            if not result or len(result) < 20:
                return
            if field_names_to_replace:
                result = replace_field_names(result, field_names_to_replace)
                print('Field names replaced')

            return result
    except Exception as err:
        print(err)
        return


def convert_ogr_to_geojson(file_path, file_format):
    """
    Convert a layer (in a format supported by ogr) to a GeoJSON layer.
    Used in fallback, if the conversion failed with 'VectorTranslate'.

    Parameters
    ----------
    file_path: str
        Path of the input file.
    file_format: str
        Format of the input layer

    Returns
    -------
    raw_geojson: bytes
        The resulting GeoJSON FeatureCollection.
    """
    regex_field_name = re.compile("[^a-zA-Z0-9_-ëêàáâãæêéèñòóô]+")

    in_driver = GetDriverByName(file_format)
    out_driver = GetDriverByName('MEMORY')

    f_in = in_driver.Open(file_path)
    input_layer = f_in.GetLayer()

    outSpRef = SpatialReference()
    outSpRef.ImportFromEPSG(4326)
    coords_transform = CoordinateTransformation(
        input_layer.GetSpatialRef(), outSpRef)

    f_out = out_driver.CreateDataSource('')
    output_layer = f_out.CreateLayer('', outSpRef)

    input_lyr_defn = input_layer.GetLayerDefn()
    for i in range(input_lyr_defn.GetFieldCount()):
        fieldDefn = input_lyr_defn.GetFieldDefn(i)
        fieldDefn.SetName(regex_field_name.sub('_', fieldDefn.GetNameRef()))
        output_layer.CreateField(fieldDefn)

    output_lyr_defn = output_layer.GetLayerDefn()
    nb_field = output_lyr_defn.GetFieldCount()
    field_names = [output_lyr_defn.GetFieldDefn(i).GetNameRef()
                   for i in range(nb_field)]

    res = []
    for inFeature in input_layer:
        geom = inFeature.GetGeometryRef()
        outFeature = OgrFeature(output_lyr_defn)
        # Don't try to transform empty geometry :
        if geom:
            geom.Transform(coords_transform)
            outFeature.SetGeometry(geom)
        else:
            outFeature.SetGeometry(None)
        outFeature.SetFID(inFeature.GetFID())
        for i in range(output_lyr_defn.GetFieldCount()):
            outFeature.SetField(
                field_names[i],
                inFeature.GetField(i))
        res.append(outFeature.ExportToJson())
        outFeature.Destroy()
        inFeature.Destroy()

    f_in.Destroy()
    f_out.Destroy()

    return ''.join([
        '''{"type":"FeatureCollection","features":[''',
        ','.join(res),
        ''']}'''
        ]).encode()


def make_geojson_links(
        ref_layer_geojson, csv_table, field_i, field_j, field_fij, join_field):
    gdf = GeoDataFrame.from_features(ref_layer_geojson["features"])
    gdf.loc[:, join_field] = gdf.loc[:, join_field].astype(str)
    gdf.set_index(join_field, inplace=True, drop=False)
    gdf.geometry = _compute_centroids(gdf.geometry)
    table = pd_read_json(csv_table)
    table.loc[:, (field_i, field_j)] = \
        table.loc[:, (field_i, field_j)].astype(str)
    table = \
        table[table[field_i].isin(gdf.index) & table[field_j].isin(gdf.index)]
    geoms_loc = gdf.geometry.loc
    ft_template_start = \
        '''{"type":"Feature","geometry":{"type":"LineString","coordinates":['''
    geojson_features = []
    for n, id_i, id_j, fij in table[[field_i, field_j, field_fij]].itertuples():
        pts = \
            list(geoms_loc[id_i].coords)[0] + list(geoms_loc[id_j].coords)[0]
        geojson_features.append(''.join([
                ft_template_start,
                '''[{0},{1}],[{2},{3}]'''.format(*pts),
                ''']},"properties":{"''',
                '''{0}":"{1}","{2}":"{3}","{4}":"{5}"'''
                .format(field_i, id_i, field_j, id_j, field_fij, fij),
                '''}}'''
                ])
            )

    return ''.join([
        '''{"type":"FeatureCollection","features":[''',
        ','.join(geojson_features),
        ''']}'''
        ]).encode()


def make_carto_doug(file_path, field_name, iterations):
    gdf, replaced_id_field = try_open_geojson(file_path)
    proj_robinson = (
            "+proj=robin +lon_0=0 +x_0=0 +y_0=0 "
            "+ellps=WGS84 +datum=WGS84 +units=m +no_defs")

    gdf.to_crs(proj_robinson, inplace=True)
    if replaced_id_field and field_name == 'id':
        field_name = '_id'
    if not gdf[field_name].dtype in (int, float):
        gdf.loc[:, field_name] = gdf[field_name].replace('', np.NaN)
        gdf.loc[:, field_name] = gdf[field_name].astype(float)
    gdf = gdf[gdf[field_name].notnull()]
    gdf = gdf.iloc[gdf[field_name].to_numpy().nonzero()]
    gdf.index = range(len(gdf))
    make_cartogram(gdf, field_name, iterations)
    result_json = json.loads(gdf.to_crs({"init": "epsg:4326"}).to_json())
    repairCoordsPole(result_json)
    return json.dumps(result_json).encode()


def olson_transform(geojson, scale_values):
    """
    Scale GeoJSON features.

    Inplace scaling transformation of each polygon of the geojson provided
    according to the "scale values" also provided.

    Parameters
    ----------
    geojson: dict
        The geojson of polygon to transform
        (it might be useful to have choosen an appropriate projection as we
        want to deal with the area)
    scale_values: list
        The pre-computed scale values for olson transformation
        (1 = no transformation)

    Returns
    -------
        Nothing
    """
    if len(geojson["features"]) != len(scale_values):
        raise ValueError("Inconsistent number of features/values")
    for val, feature in zip(scale_values, geojson['features']):
        geom = shape(feature["geometry"])
        feature['properties']['ref_area'] = geom.area
        if hasattr(geom, '__len__'):
            feature["geometry"] = mapping(
                MultiPolygon([scale(g, xfact=val, yfact=val) for g in geom]))
        else:
            feature["geometry"] = mapping(scale(geom, xfact=val, yfact=val))
    geojson['features'].sort(
        key=lambda x: x['properties']['ref_area'], reverse=True)


def reproj_convert_layer_kml(geojson_path):
    """
    Convert a GeoJSON FeatureCollection to KML format.

    Convert a GeoJSON FeatureCollection to KML format
     when the user requests an export.

    Parameters
    ----------
    geojson_path: str
        Path of the input GeoJSON FeatureCollection to be converted.

    Returns
    -------
    result: bytes
        The resulting KML file.
    """
    ## TODO : Use VectorTranslate to make the conversion?
    process = Popen(["ogr2ogr", "-f", "KML",
                     "-preserve_fid",
                     "-t_srs", "EPSG:4326",
                     "/dev/stdout", geojson_path], stdout=PIPE)
    stdout, _ = process.communicate()
    return stdout


def reproj_convert_layer(geojson_path, output_path, file_format, output_crs):
    """
    Concert GeoJSON to GML or Shapefile and write it to disk.

    Convert a GeoJSON FeatureCollection to GML or ESRI Shapefile format and
    reproject the geometries if needed (used when the user requests an export).

    Parameters
    ----------
    geojson_path: str
        Path of the input GeoJSON FeatureCollection to be converted.

    output_path: str
        Path for the resulting Shapefile/GML (should be in a directory
        created by tempfile.TemporaryDirectory).

    file_format: str
        The format of the expected result ('ESRI Shapefile' or 'GML' is expected).

    output_crs: str
        The output srs to use (in proj4 string format).

    Returns
    -------
    result_code: int
        Should return 0 if everything went fine..
    """
    ## TODO : Use VectorTranslate to make the conversion?
    input_crs = "epsg:4326"
    layer_name = output_path.split('/')
    layer_name = layer_name[len(layer_name) - 1].split('.')[0]

    in_driver = GetDriverByName("GeoJSON")
    out_driver = GetDriverByName(file_format)

    inSpRef = SpatialReference()
    inSpRef.ImportFromEPSG(int(input_crs.split("epsg:")[1]))

    outSpRef = SpatialReference()
    ret_val = outSpRef.ImportFromProj4(output_crs)
    if not ret_val == 0:
        raise ValueError("Error when importing the output crs")

    coords_transform = CoordinateTransformation(inSpRef, outSpRef)

    f_in = in_driver.Open(geojson_path)
    input_layer = f_in.GetLayer()
    f_out = out_driver.CreateDataSource(output_path)
    output_layer = f_out.CreateLayer(layer_name, outSpRef)

    input_lyr_defn = input_layer.GetLayerDefn()
    for i in range(input_lyr_defn.GetFieldCount()):
        fieldDefn = input_lyr_defn.GetFieldDefn(i)
        output_layer.CreateField(fieldDefn)

    output_lyr_defn = output_layer.GetLayerDefn()

    for inFeature in input_layer:
        geom = inFeature.GetGeometryRef()
        outFeature = OgrFeature(output_lyr_defn)
        if geom:
            geom.Transform(coords_transform)
            outFeature.SetGeometry(geom)
        else:
            outFeature.SetGeometry(None)

        for i in range(output_lyr_defn.GetFieldCount()):
            outFeature.SetField(output_lyr_defn.GetFieldDefn(i).GetNameRef(),
                                inFeature.GetField(i))
        output_layer.CreateFeature(outFeature)
        outFeature.Destroy()
        inFeature.Destroy()
    f_in.Destroy()
    f_out.Destroy()

    if "Shapefile" in file_format:
        outSpRef.MorphToESRI()
        with open(output_path.replace(".shp", ".prj"), 'w') as file_proj:
            file_proj.write(outSpRef.ExportToWkt())
        with open(output_path.replace(".shp", ".cpg"), "w") as encoding_file:
            encoding_file.write("ISO-8859-1")
    return 0


def check_projection(proj4string):
    """Check if a proj4string is valid."""
    if not isinstance(proj4string, str):
        return False
    if proj4string[0] == '"' and proj4string[len(proj4string) - 1] == '"':
        proj4string = proj4string[1:len(proj4string) - 1]
    if "epsg:" in proj4string[:5]:
        proj4string = "".join(["+init=", proj4string])
    try:
        pyproj_Proj(proj4string)
        outSpRef = SpatialReference()
        ret_val = outSpRef.ImportFromProj4(proj4string)
        if not ret_val == 0:
            return False
        return proj4string
    except:
        return False


def on_geom(geom):
    for pts in geom:
        for pt in pts:
            if pt[0] > 179.9999:
                pt[0] = 179.9999
            elif pt[0] < -179.9999:
                pt[0] = -179.9999
            if pt[1] > 89.9999:
                pt[1] = 89.9999
            elif pt[1] < -89.9999:
                pt[1] = -89.9999


def repairCoordsPole(geojson):
    for ft in geojson['features']:
        geom = ft["geometry"]
        if not geom or not 'type' in geom or not 'coordinates' in geom:
            continue
        if "MultiPolygon" in geom["type"]:
            for poly in geom['coordinates']:
                # exterior = poly[:1]
                on_geom(poly[:1])
                if(len(poly) > 2):
                    # interiors  = poly[1:]
                    on_geom(poly[1:])
        elif "Polygon" in geom["type"]:
            # poly = geom['coordinates']
            # exterior = poly[:1]
            on_geom(geom['coordinates'][:1])
            if(len(geom['coordinates']) > 2):
                # interiors  = poly[1:]
                on_geom(geom['coordinates'][1:])


def multi_to_single(gdf, columns=None):
    values = gdf[[i for i in gdf.columns if i != 'geometry']]
    geom = gdf.geometry
    geoms, attrs = [], []

    for i in range(len(gdf)):
        try:  # if hasattr(geom, '__len__'):
            for single_geom in geom.iloc[i]:
                geoms.append(single_geom)
                attrs.append(values.iloc[i])
        except:  # else:
            geoms.append(geom.iloc[i])
            attrs.append(values.iloc[i])

    return GeoDataFrame(
        attrs,
        index=range(len(geoms)),
        geometry=geoms,
        columns=columns or [i for i in gdf.columns if i != 'geometry']
        )


def replace_geojson_id_field(input_file, fb=False):
    with open(input_file, 'rb') as f:
        data = f.read()
    nb_ft = data.count(b'"Feature"')
    _nb_ft = data.count(b'"geometry"')
    if not fb and data.count(b'"id"') == nb_ft and nb_ft == _nb_ft:
        data = data.replace(b'"id"', b'"_id"')
        with open(input_file, 'wb') as f:
            f.write(data)
    else:
        data = json.loads(data)
        for ix, ft in enumerate(data['features']):
            ft['properties']['_id'] = ft['properties']['id']
            del ft['properties']['id']
        with open(input_file, 'wb') as f:
            f.write(json.dumps(data).encode())

def try_open_geojson(file_path):
    replaced = False
    try:
        gdf = GeoDataFrame.from_file(file_path)
    except fiona_err.CPLE_AppDefinedError as err:
        replace_geojson_id_field(file_path)
        replaced = True
        gdf = GeoDataFrame.from_file(file_path)
    return gdf, replaced
