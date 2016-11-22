"use strict";

var display_box_symbol_typo = function(layer, field){
    var fetch_symbol_categories = function(){
        let categ = document.getElementsByClassName("typo_class"),
            symbol_map = new Map();
        for(let i = 0; i < categ.length; i++){
            let selec =  categ[i].querySelector(".symbol_section"),
                new_name = categ[i].querySelector(".typo_name").value;
                cats[i].new_name = new_name;
            if(selec.style.backgroundImage.length > 7){
                let img = selec.style.backgroundImage.split("url(")[1].substring(1).slice(0,-2);
                let size = +categ[i].querySelector("#symbol_size").value
                symbol_map.set(categ[i].__data__.name, [img, size, new_name, cats[i].nb_elem]);
                cats[i].img = selec.style.backgroundImage;
            } else {
                symbol_map.set(categ[i].__data__.name, [null, 0, new_name, cats[i].nb_elem]);
                cats[i].img = default_d_url;
            }
        }
        return symbol_map;
    }

    if(!window.default_symbols){
        window.default_symbols = [];
        prepare_available_symbols();
    }
    var nb_features = current_layers[layer].n_features,
        data_layer = user_data[layer],
        cats = fields_TypoSymbol.cats[field] || [],
        res_symbols = window.default_symbols,
        default_d_url = 'url("data:image/svg+xml;base64,PHN2ZyB2ZXJzaW9uPSIxLjEiIGlkPSJmbGFnIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB4PSIwcHgiIHk9IjBweCIgd2lkdGg9IjMycHgiIGhlaWdodD0iMzJweCIgdmlld0JveD0iMCAwIDU3OS45OTcgNTc5Ljk5NyIgZW5hYmxlLWJhY2tncm91bmQ9Im5ldyAwIDAgNTc5Ljk5NyA1NzkuOTk3IiB4bWw6c3BhY2U9InByZXNlcnZlIj4KPHBhdGggZmlsbD0icGFyYW0oZmlsbCkgIzAwMCIgZmlsbC1vcGFjaXR5PSJwYXJhbShmaWxsLW9wYWNpdHkpIiBzdHJva2U9InBhcmFtKG91dGxpbmUpICNGRkYiIHN0cm9rZS1vcGFjaXR5PSJwYXJhbShvdXRsaW5lLW9wYWNpdHkpIiBzdHJva2Utd2lkdGg9InBhcmFtKG91dGxpbmUtd2lkdGgpIDAiIGQ9Ik0yMzEuODQ2LDQ3Mi41NzJWMzEuODA2aC0yMi4xOHY0NDAuNTU3JiMxMDsmIzk7Yy0zNC4wMTYsMi42NDktNTkuNDE5LDE4Ljc2Ny01OS40MTksMzguODcxYzAsMjIuMDIxLDMwLjQ1NiwzOS4yNzEsNjkuMzM3LDM5LjI3MWMzOC44NzcsMCw2OS4zMzItMTcuMjUsNjkuMzMyLTM5LjI3MSYjMTA7JiM5O0MyODguOTE3LDQ5MS41OTUsMjY0LjY3NCw0NzUuNzY0LDIzMS44NDYsNDcyLjU3MnoiLz4KPHBvbHlnb24gZmlsbD0icGFyYW0oZmlsbCkgIzAwMCIgZmlsbC1vcGFjaXR5PSJwYXJhbShmaWxsLW9wYWNpdHkpIiBzdHJva2U9InBhcmFtKG91dGxpbmUpICNGRkYiIHN0cm9rZS1vcGFjaXR5PSJwYXJhbShvdXRsaW5lLW9wYWNpdHkpIiBzdHJva2Utd2lkdGg9InBhcmFtKG91dGxpbmUtd2lkdGgpIDAiIHBvaW50cz0iMjM1LjI0MywyOS40OTIgMjMzLjcyMywyMDcuNjI4IDQyOS43NDksMjEwLjMyOSAiLz4KPC9zdmc+")';

    if(cats.length == 0){
        var categories = new Map();
        for(let i = 0; i < nb_features; ++i){
            let value = data_layer[i][field];
            let ret_val = categories.get(value);
            if(ret_val)
                categories.set(value, [ret_val[0] + 1, [i].concat(ret_val[1])]);
            else
                categories.set(value, [1, [i]]);
        }
        categories.forEach( (v,k) => { cats.push({name: k, new_name: k, nb_elem: v[0], img: default_d_url}) });
    }
    let nb_class = cats.length;

    return function(){
        var modal_box = make_dialog_container(
            "symbol_box",
            i18next.t("app_page.symbol_typo_box.title", {layer: layer, nb_features: nb_features}),
            "dialog");
        var newbox = d3.select("#symbol_box").select(".modal-body");

        newbox.append("h3").html("")
        newbox.append("p")
                .html(i18next.t("app_page.symbol_typo_box.field_categ", {field: field, nb_class: nb_class, nb_features: nb_features}));
        newbox.append("ul").style("padding", "unset").attr("id", "typo_categories")
                .selectAll("li")
                .data(cats).enter()
                .append("li")
                    .styles({margin: "auto", "list-style": "none"})
                    .attr("class", "typo_class")
                    .attr("id", (d,i) => ["line", i].join('_'));

        newbox.selectAll(".typo_class")
                .append("span")
                .attrs({"class": "three_dots"})
                .style("cursor", "grab");

        newbox.selectAll(".typo_class")
                .append("input")
                .styles({width: "100px", height: "auto", display: "inline-block", "vertical-align": "middle", "margin-right": "7.5px"})
                .attr("class", "typo_name")
                .attr("value", d => d.new_name)
                .attr("id", d => d.name);

        newbox.selectAll(".typo_class")
                .insert("p")
                .attr("title", "Click me to choose a symbol!")
                .attr("class", "symbol_section")
                .style("margin", "auto")
                .style("background-image", d => d.img)
                .style("vertical-align", "middle")
                .styles({width: "32px", height: "32px", margin: "0px 1px 0px 1px",
                        "border-radius": "10%", border: "1px dashed blue",
                        display: "inline-block", "background-size": "32px 32px"
                      })
                .on("click", function(){
                    box_choice_symbol(res_symbols, ".dialog")
                      .then(confirmed => {
                        if(confirmed){
                            this.style.backgroundImage = confirmed;
                        }
                    });
                });

        newbox.selectAll(".typo_class")
                .insert("span")
                .html( d => i18next.t("app_page.symbol_typo_box.count_feature", {nb_features: d.nb_elem}));

        newbox.selectAll(".typo_class")
                .insert("input").attr("type", "number").attr("id", "symbol_size")
                .style("width", "38px").style("display", "inline-block")
                .attr("value", 32);

        newbox.selectAll(".typo_class")
                .insert("span")
                .style("display", "inline-block")
                .html(" px");
        new Sortable(document.getElementById("typo_categories"));

        let deferred = Q.defer(),
            container = document.getElementById("symbol_box"),
            _onclose = () => {
                deferred.resolve(false);
                modal_box.close();
                container.remove();
              }
        container.querySelector(".btn_cancel").onclick = _onclose;
        container.querySelector("#xclose").onclick = _onclose;
        container.querySelector(".btn_ok").onclick = function(){
            let symbol_map = fetch_symbol_categories();
            fields_TypoSymbol.cats[field] = cats;
            deferred.resolve([nb_class, symbol_map]);
            modal_box.close();
            container.remove();
        }
        return deferred.promise;
    }
};

function box_choice_symbol(sample_symbols, parent_css_selector){
    var modal_box = make_dialog_container(
        "box_choice_symbol",
        i18next.t("app_page.box_choice_symbol.title"),
        "dialog");
    var newbox = d3.select("#box_choice_symbol").select(".modal-body");

    newbox.append("h3").html(i18next.t("app_page.box_choice_symbol.title"));
    newbox.append("p").html(i18next.t("app_page.box_choice_symbol.select_symbol"));

    var box_select = newbox.append("div")
                        .styles({width: "190px", height: "100px", overflow: "auto", border: "1.5px solid #1d588b"})
                        .attr("id", "symbols_select");

    box_select.selectAll("p")
        .data(sample_symbols)
        .enter()
        .append("p")
        .attrs( d => ({
          "id": "p_" + d[0].replace(".svg", ""),
          "title": d[0]
        }))
        .html(d => d[1])
        .styles({width: "32px", height: "32px",
                 margin: "auto", display: "inline-block"});

    box_select.selectAll("svg")
        .attr("id", function(){ return this.parentElement.id.slice(2) })
        .attrs({height: "32px", width: "32px"})
        .on("click", function(){
            box_select.selectAll("svg").each(function(){
                this.parentElement.style.border = "";
                this.parentElement.style.padding = "0px";
            })
            this.parentElement.style.padding = "-1px";
            this.parentElement.style.border = "1px dashed red";
            let svg_dataUrl = [
                'url("data:image/svg+xml;base64,',
                btoa(new XMLSerializer().serializeToString(this)),
                '")'].join('');
            newbox.select("#current_symb").style("background-image", svg_dataUrl);
        });

    newbox.append("p")
        .attr("display", "inline")
        .html(i18next.t("app_page.box_choice_symbol.upload_symbol"));
    newbox.append("button")
        .html(i18next.t("app_page.box_choice_symbol.browse"))
        .on("click", function(){
            let input = document.createElement('input');
            input.setAttribute("type", "file");
            input.onchange = function(event){
                let file = event.target.files[0];
                let file_name = file.name;
                let reader = new FileReader()
                reader.onloadend = function(){
                    let result = reader.result;
                    let dataUrl_res = ['url("', result, '")'].join('');
                    newbox.select("#current_symb").style("background-image", dataUrl_res);
                }
                reader.readAsDataURL(file);
            }
            input.dispatchEvent(new MouseEvent("click"));
        });

    newbox.insert("p").html(i18next.t("app_page.box_choice_symbol.selected_symbol"))
    newbox.insert("p")
            .attrs({"class": "symbol_section", "id": "current_symb"})
            .styles({width: "32px", height: "32px", display: "inline-block",
                    "border-radius": "10%", "background-size": "32px 32px",
                    "vertical-align": "middle", "margin": "auto", "background-image": "url('')"
                  });

    let deferred = Q.defer(),
        container = document.getElementById("box_choice_symbol");

    container.querySelector(".btn_ok").onclick = function(){
        let res_url = newbox.select("#current_symb").style("background-image");
        deferred.resolve(res_url);
        modal_box.close();
        container.remove();
        if(parent_css_selector) reOpenParent(parent_css_selector);
    }

    let _onclose = () => {
        deferred.resolve(false);
        modal_box.close();
        container.remove();
        if(parent_css_selector) reOpenParent(parent_css_selector);

    };
    container.querySelector(".btn_cancel").onclick = _onclose;
    container.querySelector("#xclose").onclick = _onclose;
    return deferred.promise;
};


function make_style_box_indiv_symbol(label_node){
    let current_options = {size: label_node.getAttribute("width")};
    let ref_coords = {x: +label_node.getAttribute("x") + (+current_options.size.slice(0, -2) / 2),
                      y: +label_node.getAttribute("y") + (+current_options.size.slice(0, -2) / 2)};
    let new_params = {};
    let self = this;
    make_confirm_dialog2("styleTextAnnotation", "Label options")
        .then(function(confirmed){
            if(!confirmed){
                label_node.setAttribute("width", current_options.size);
                label_node.setAttribute("height", current_options.size);
                label_node.setAttribute("x", ref_coords.x - (+current_options.size.slice(0, -2) / 2));
                label_node.setAttribute("y", ref_coords.y - (+current_options.size.slice(0, -2) / 2));
            }
        });
    let box_content = d3.select(".styleTextAnnotation").select(".modal-body").insert("div");
    box_content.append("p").html("Image size ")
            .append("input").attrs({type: "number", id: "font_size", min: 0, max: 150, step: "any", value: +label_node.getAttribute("width").slice(0,-2)})
            .on("change", function(){
                let new_val = this.value + "px";
                label_node.setAttribute("width", new_val);
                label_node.setAttribute("height", new_val);
                label_node.setAttribute("x", ref_coords.x - (+this.value / 2));
                label_node.setAttribute("y", ref_coords.y - (+this.value / 2));
            });
};
