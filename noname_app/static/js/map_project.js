"use strict";

function get_map_template(){
    var map_config = new Object(),
        layers_style = [],
        layers = map.selectAll("g.layer"),
        map_title = document.getElementById('map_title'),
        displayed_legend = d3.selectAll(".legend_feature:not(.title)"),
        zoom_transform = d3.zoomTransform(svg_map);

    map_config.projection = current_proj_name;
    map_config.projection_scale = proj.scale();
    map_config.projection_translate = proj.translate();
    map_config.projection_center = proj.center();
    map_config.projection_rotation = proj.rotate();
    map_config.zoom_translate = [zoom_transform.x, zoom_transform.y];
    map_config.zoom_scale = zoom_transform.k;
    map_config.div_width = +w;
    map_config.div_height = +h;
    map_config.n_layers = layers._groups[0].length;
    map_config.displayed_legend = displayed_legend.size() > 0 ? true : false;

    if(map_title){
        map_config.title = {
            "content": map_title.textContent,
            "x": map_title.getAttribute("x"),
            "y": map_title.getAttribute("y"),
            "style": map_title.getAttribute("style")
            };
    }

    for(let i=map_config.n_layers-1; i > -1; --i){
        let layer_name = layers._groups[0][i].id,
            nb_ft = current_layers[layer_name].n_features,
            selection;

        layers_style[i] = new Object();
        layers_style[i].layer_name = layer_name;
        layers_style[i].n_features = nb_ft;

        if(current_layers[layer_name]["stroke-width-const"])
            layers_style[i]["stroke-width-const"] = current_layers[layer_name]["stroke-width-const"];

        if(current_layers[layer_name].fixed_stroke)
            layers_style[i].fixed_stroke = current_layers[layer_name].fixed_stroke;

        if(current_layers[layer_name].colors_breaks)
            layers_style[i].colors_breaks = JSON.stringify(current_layers[layer_name].colors_breaks);

        if (current_layers[layer_name].targeted){
            selection = map.select("#" + layer_name).selectAll("path");
            layers_style[i].fill_opacity = selection.style("fill-opacity");
            layers_style[i].targeted = true;
            layers_style[i].topo_geom = String(current_layers[layer_name].key_name);
            layers_style[i].fill_color = current_layers[layer_name].fill_color;
        } else if(!current_layers[layer_name].renderer){
            selection = map.select("#" + layer_name).selectAll("path");
        } else if(current_layers[layer_name].renderer.indexOf("PropSymbols") > -1){
            let type_symbol = current_layers[layer_name].symbol;
            selection = map.select("#" + layer_name).selectAll(type_symbol);
            let features = Array.prototype.map.call(svg_map.querySelector("#" + layer_name).getElementsByTagName(type_symbol), function(d){ return d.__data__; });
            layers_style[i].symbol = type_symbol;
            layers_style[i].rendered_field = current_layers[layer_name].rendered_field;
            // layers_style[i].rendered_field2 = current_layers[layer_name].rendered_field2 ? current_layers[layer_name].rendered_field2 : undefined;
            layers_style[i].renderer = current_layers[layer_name].renderer;
            layers_style[i].size = current_layers[layer_name].size;
            layers_style[i].fill_color = current_layers[layer_name].fill_color;
            layers_style[i].ref_layer_name = current_layers[layer_name].ref_layer_name;
            layers_style[i].geo_pt = {
              type: "FeatureCollection",
              features: features
            };
        } else if (current_layers[layer_name].renderer == "Stewart"
                    || current_layers[layer_name].renderer == "Gridded"
                    || current_layers[layer_name].renderer == "Choropleth"
                    || current_layers[layer_name].renderer == "Categorical"
                    || current_layers[layer_name].renderer == "Carto_doug"){
            selection = map.select("#" + layer_name).selectAll("path");
            layers_style[i].renderer = current_layers[layer_name].renderer;
            layers_style[i].topo_geom = String(current_layers[layer_name].key_name);
            layers_style[i].fill_color = current_layers[layer_name].fill_color;
            layers_style[i].rendered_field = current_layers[layer_name].rendered_field;
            layers_style[i].ref_layer_name = current_layers[layer_name].ref_layer_name;
            let color_by_id = [];
            selection.each(function(){
                color_by_id.push(rgb2hex(this.style.fill));
            });
            layers_style[i].color_by_id = color_by_id;
            if(current_layers[layer_name].renderer !== "Categorical") {
                layers_style[i].options_disc = current_layers[layer_name].options_disc;
            } else {
                layers_style[i].color_map = [...current_layers[layer_name].color_map];
            }
        } else if (current_layers[layer_name].renderer == "Links"
                    || current_layers[layer_name].renderer == "DiscLayer"){
            selection = map.select("#" + layer_name).selectAll("path");
            layers_style[i].fill_color = current_layers[layer_name].fill_color;
            layers_style[i].topo_geom = String(current_layers[layer_name].key_name);
            layers_style[i].rendered_field = current_layers[layer_name].rendered_field;
            layers_style[i].ref_layer_name = current_layers[layer_name].ref_layer_name;
            layers_style[i].size = current_layers[layer_name].size;
            layers_style[i].min_display = current_layers[layer_name].min_display;
            if(current_layers[layer_name].renderer == "DiscLayer"){
                layers_style[i].result = new Array(nb_ft)
                for(let j = 0; j < nb_ft; j++)
                    layers_style[i].result[j] = nb_ft;
            } else {
                layers_style[i].topo_geom = String(current_layers[layer_name].key_name);
                layers_style[i].linksbyId = current_layers[layer_name].linksbyId.splice(0, nb_ft)
            }
        } else if (current_layers[layer_name].renderer == "TypoSymbols"){
            selection = map.select("#" + layer_name).selectAll("image")
            layers_style[i].symbols_map = JSON.parse(JSON.stringify([...current_layers[layer_name].symbols_map]));
            layers_style[i].rendered_field = current_layers[layer_name].rendered_field;
            layers_style[i].ref_layer_name = current_layers[layer_name].ref_layer_name;

            let state_to_save = [];
            let selec = selection._groups[0];
            for(let i = 0; i < selec.length ; i++){
                let ft = selec[i];
                state_to_save.push({display: ft.style.display,
                                    data: ft.__data__,
                                    pos: [ft.getAttribute('x'), ft.getAttribute('y')],
                                    size: ft.getAttribute('width')
                                    });
            }
            layers_style[i].current_state = state_to_save;
        } else if(current_layers[layer_name].renderer == "Label") {
            selection = map.select("#" + layer_name).selectAll("text");
            layers_style[i].rendered_field = current_layers[layer_name].rendered_field;
            layers_style[i].contents_pos = [];
        } else {
            selection = map.select("#" + layer_name).selectAll("path");
        }
        layers_style[i].stroke_opacity = selection.style("stroke-opacity");
        layers_style[i].fill_opacity = selection.style("fill-opacity");
    }

    return Q.all(layers_style.map( obj => {return obj.topo_geom ? request_data("GET", "/get_layer/" + obj.topo_geom, null) : null}))
        .then(function(result){
            for(let i = 0; i < layers_style.length; i++){
                    if(result[i] && result[i].target){
                        layers_style[i].topo_geom = result[i].target.responseText;
                    }
                }
            console.log(JSON.stringify({"map_config": map_config, "layers": layers_style}))
            return JSON.stringify({"map_config": map_config, "layers": layers_style});;
        });
}

// Function triggered when the user request a download of its map preferences
function save_map_template(){
    get_map_template().then(
        function(json_params){
            let dlAnchorElem = document.createElement('a');
            dlAnchorElem.style.display = "none";
            dlAnchorElem.setAttribute("href", "data:text/json;charset=utf-8," + encodeURIComponent(json_params));
            dlAnchorElem.setAttribute("download", "noname_properties.json");
            document.body.appendChild(dlAnchorElem);
            dlAnchorElem.click();
            dlAnchorElem.remove();
    });
}

function load_map_template(){
    let input_button = d3.select(document.createElement('input'))
                    .attr("type", "file").attr("name", "file")
                    .attr("enctype", "text/json")
                    .on('change', function(){ prepareReading(d3.event) });

    let prepareReading = function(event){
        let file = event.target.files[0],
            reader = new FileReader();
        reader.onloadend = function(){ apply_user_preferences(reader.result); }
        reader.readAsText(file);
    }

    input_button.node().dispatchEvent(new MouseEvent("click"))
}

function apply_user_preferences(json_pref){
    let preferences = JSON.parse(json_pref),
        map_config = preferences.map_config,
        layers = preferences.layers;

    var func_name_corresp = new Map([
        ["Links", "flow"], ["PropSymbolsChoro", "choroprop"],
        ["PropSymbols", "prop"], ["Stewart", "smooth"], ["Gridded", "grid"],
        ["DiscLayer", "discont"], ["Choropleth", "choro"], ["Categorical", "typo"]
    ]);

    // Update some global variables with the readed values in order to retrieve
    // the same map size / orientation / zoom / etc ...
    w = +map_config.div_width;
    h = +map_config.div_height;
    canvas_mod_size([w, h]);
    document.getElementById("input-width").value = w;
    document.getElementById("input-height").value = h;
    current_proj_name = map_config.projection;
    proj = eval(available_projections.get(current_proj_name));
    s = map_config.projection_scale;
    t = map_config.projection_translate;
    proj.scale(s).translate(t).rotate(map_config.projection_rotation);
    path = d3.geoPath().projection(proj).pointRadius(4);
    map.selectAll(".layer").selectAll("path").attr("d", path);

    let proj_select = document.getElementById('form_projection');
    proj_select.value = Array.prototype.filter.call(proj_select.options, function(d){ if(d.text == current_proj_name) { return d;}})[0].value;

    for(let i = map_config.n_layers - 1; i > -1; --i){
        let layer_name = layers[i].layer_name,
            symbol,
            layer_selec;

        let fill_opacity = layers[i].fill_opacity,
            stroke_opacity = layers[i].stroke_opacity;

        if(layers[i].topo_geom && layer_name != "Sphere" && layer_name != "Simplified_land_polygons"){
            let tmp = {skip_alert: true};
            if(layers[i].targeted){
                tmp['target_layer_on_add'] = true;
            } else if(layers[i].renderer){
                tmp['func_name'] = func_name_corresp.get(layers[i].renderer)
                tmp['result_layer_on_add'] = true;
            }
            tmp['choosed_name'] = layer_name;
            handle_reload_TopoJSON(layers[i].topo_geom, tmp).then(function(n_layer_name){
                console.log([layer_name, n_layer_name])
                layer_name = n_layer_name;
                if(layers[i].renderer){
                    current_layers[layer_name].renderer = layers[i].renderer;
                }

                symbol = "path";
                layer_selec = map.select("#" + layer_name);

                current_layers[layer_name].rendered_field = layers[i].rendered_field;
                current_layers[layer_name]['stroke-width-const'] = layers[i]['stroke-width-const'];
                current_layers[layer_name].fixed_stroke = layers[i].fixed_stroke;
                if(layers[i].ref_layer_name)
                    current_layers[layer_name].ref_layer_name = layers[i].ref_layer_name;
                if(layers[i].size)
                    current_layers[layer_name].size = layers[i].size;
                if(layers[i].colors_breaks)
                    current_layers[layer_name].colors_breaks = JSON.parse(layers[i].colors_breaks);
                if(layers[i].fill_color)
                    current_layers[layer_name].fill_color = layers[i].fill_color;
                console.log(layers[i])
                if(layers[i].renderer){
                    if(layers[i].renderer == "Choropleth"
                        || layers[i].renderer == "Stewart"
                        || layers[i].renderer == "Gridded"){
                        layer_selec.selectAll("path")
                                .style("fill", (d,j) => layers[i].color_by_id[j])
                    } else if (layers[i].renderer == "Links"){
                        current_layers[layer_name].linksbyId = layers[i].linksbyId;
                        current_layers[layer_name].min_display = layers[i].min_display;
                    } else if (layers[i].renderer == "DiscLayer"){
                        current_layers[layer_name].result = new Map(layers[i].result);
                        layer_selec.selectAll("path").style("stroke-width", (d,i) => { return current_layers[layer_name].result.get(d.id); });
                    }
                } else if(layers[i].fill_color.random) {
                        layer_selec
                            .selectAll(symbol)
                            .style("fill", () => Colors.names[Colors.random()]);
                }
                layer_selec.selectAll(symbol)
                        .style("fill-opacity", fill_opacity)
                        .style("stroke-opacity", stroke_opacity)
            });
        } else if (layer_name == "Sphere" || layer_name == "Graticule"){
            add_layout_feature(layer_name.toLowerCase());
        } else if (layer_name == "Simplified_land_polygons"){
            add_simplified_land_layer();
        } else if (layers[i].renderer && layers[i].renderer.startsWith("PropSymbol")){
            let geojson_pt_layer = layers[i].geo_pt;

            // let layer_to_append = map.append("g").attr("id", layer_name).attr("class", "result_layer layer");
            let rendering_params = {
                new_name: layer_name,
                field: layers[i].rendered_field,
                fill_color: layers[i].fill_color,
                ref_value:  layers[i].size[0],
                ref_size: layers[i].size[1],
                symbol: layers[i].symbol,
                nb_features: geojson_pt_layer.features.length,
            };

            make_prop_symbols(rendering_params, geojson_pt_layer)

        } else if (layers[i].renderer && layers[i].renderer.startsWith("Label")){
            null;
            // let rendering_params = {
            //     uo_layer_name: layer_name,
            //     label_field: ,
            //
            // };
            // render_label(null, rendering_params, layers[i].data_labels);
          } else if (layers[i].renderer && layers[i].renderer.startsWith("Categorical")){
              let rendering_params = {
                  colorByFeature: layers[i].color_by_id,
                  color_map: new Map(layers[i].color_map),
                  rendered_field: layers[i].rendered_field,
                  renderer: "Categorical"
              };
              render_categorical(layers[i].ref_layer_name, rendering_params);
        } else if (layers[i].renderer && layers[i].renderer.startsWith("Choropleth")){
            let rendering_params = {
                    "nb_class": "",
                    "type":"",
                    "schema": layers[i].options_disc.schema,
                    "no_data": layers[i].options_disc.no_data,
                    "colors": layers[i].options_disc.colors,
                    "colorsByFeature": layers[i].color_by_id,
                    "renderer": "Choropleth",
                    "rendered_field": layers[i].rendered_field,
                    // "new_name": layer_name
                };
            render_choro(layer_name, rendering_params);
        } else {
            null;
        }

        if(layers[i].is_result && map_config.displayed_legend)
            handle_legend(layer_name);
    }
    let _zoom = svg_map.__zoom;
    _zoom.k = map_config.zoom_scale;
    _zoom.x = map_config.zoom_translate[0];
    _zoom.y = map_config.zoom_translate[1];
    zoom_without_redraw();

    if(map_config.title){
        let title = document.getElementById("map_title");
        if(title){
            title.textContent = map_config.title.content;
            title.setAttribute("x", map_config.title.x);
            title.setAttribute("y", map_config.title.y);
            title.setAttribute("style", map_config.title.style);
        } else {
            title = map.append("g")
                     .attr("class", "legend_feature title")
                  .insert("text")
                     .attrs({id: "map_title", x: map_config.title.x, y: map_config.title.y, "alignment-baseline": "middle", "text-anchor": "middle"})
                     .text(map_config.title.content);
            title.node().setAttribute("style", map_config.title.style);
        }
    }
}