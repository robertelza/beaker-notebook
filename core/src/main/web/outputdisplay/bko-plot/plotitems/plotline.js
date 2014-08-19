/*
*  Copyright 2014 TWO SIGMA OPEN SOURCE, LLC
*
*  Licensed under the Apache License, Version 2.0 (the "License");
*  you may not use this file except in compliance with the License.
*  You may obtain a copy of the License at
*
*         http://www.apache.org/licenses/LICENSE-2.0
*
*  Unless required by applicable law or agreed to in writing, software
*  distributed under the License is distributed on an "AS IS" BASIS,
*  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
*  See the License for the specific language governing permissions and
*  limitations under the License.
*/

(function() {
  'use strict';
  var retfunc = function(plotUtils) {
    var PlotLine = function(data, loadOnDemand){
      this.loadOnDemand = loadOnDemand;

      this.elements = data.elements;
      delete data.elements;
      $.extend(true, this, data); // copy properties to itself
      this.format();
    };

    PlotLine.prototype.render = function(scope){
      if (this.shown === false) {
        this.clear(scope);
        return;
      }
      this.filter(scope);
      if (this.loadOnDemand === true) {
        this.prepareOnDemand(scope);
      } else {
        this.prepare(scope);
      }
      if (this.vlength === 0) {
        this.clear(scope);
      } else {
        this.draw(scope);
      }
    };

    PlotLine.prototype.getRange = function() {
      var eles = this.elements;
      var range = {
        xl : 1E100,
        xr : -1E100,
        yl : 1E100,
        yr : -1E100
      };
      for (var i = 0; i < eles.length; i++) {
        var ele = eles[i];
        range.xl = Math.min(range.xl, ele.x);
        range.xr = Math.max(range.xr, ele.x);
        range.yl = Math.min(range.yl, ele.y);
        range.yr = Math.max(range.yr, ele.y);
      }
      return range;
    };

    PlotLine.prototype.applyAxis = function(xAxis, yAxis) {
      this.xAxis = xAxis;
      this.yAxis = yAxis;
      for (var i = 0; i < this.elements.length; i++) {
        var ele = this.elements[i];
        ele.x = xAxis.getPercent(ele.x);
        ele.y = yAxis.getPercent(ele.y);
      }
      if (this.loadOnDemand !== true) {
        this.createTips();
      }
    };

    PlotLine.prototype.createTips = function() {
      for (var i = 0; i < this.elements.length; i++) {
        var ele = this.elements[i];
        this.elementProps[i].t_txt = this.createTip(ele);
      }
    };

    PlotLine.prototype.createTip = function(ele) {
      var xAxis = this.xAxis,
          yAxis = this.yAxis;
      var valx = plotUtils.getTipString(ele._x, xAxis, true),
          valy = plotUtils.getTipString(ele._y, yAxis, true);
      var tip = {};
      if (this.legend != null) {
        tip.title = this.legend;
      }
      tip.x = valx;
      tip.y = valy;
      return plotUtils.createTipString(tip);
    };

    PlotLine.prototype.format = function() {

      this.itemProps = {
        "id" : this.id,
        "cls" : "plot-line",
        "st" : this.color,
        "st_op" : this.color_opacity,
        "st_w" : this.width,
        "st_da" : this.stroke_dasharray,
        "d" : ""
      };

      this.elementProps = [];
      this.resppipe = [];

      // do not create element prop if loadOnDemand is on
      if (this.loadOnDemand === true) { return; }

      for (var i = 0; i < this.elements.length; i++) {
        var ele = this.elements[i];
        var point = {
          "id" : this.id + "_" + i,
          "cls" : "plot-resp plot-respdot",
          "isresp" : true,
          "t_txt" : ele.tip_text,
          "t_clr" : this.color == null ? "gray" : this.color,
          "r" : 5
        };
        this.elementProps.push(point);
      }

    };

    PlotLine.prototype.filter = function(scope) {
      var eles = this.elements;
      var l = plotUtils.upper_bound(eles, "x", scope.focus.xl),
          r = plotUtils.upper_bound(eles, "x", scope.focus.xr) + 1;

      l = Math.max(l, 0);
      r = Math.min(r, eles.length - 1);

      if (l > r || l == r && eles[l].x < scope.focus.xl) {
        // nothing visible, or all elements are to the left of the svg, vlength = 0
        l = 0;
        r = -1;
      }
      this.vindexL = l;
      this.vindexR = r;
      this.vlength = r - l + 1;
    };

    PlotLine.prototype.prepare = function(scope) {
      var focus = scope.focus;
      var eles = this.elements,
          eleprops = this.elementProps;
      var mapX = scope.data2scrX,
          mapY = scope.data2scrY;
      var pstr = "", skipped = false;

      this.resppipe.length = 0;

      for (var i = this.vindexL; i <= this.vindexR; i++) {
        var ele = eles[i];
        if (i === this.vindexL) {
          pstr += "M";
        } else if (i === this.vindexL + 1) {
          if (this.interpolation !== "curve") pstr += "L";
          else pstr += "C";
        }
        var x = mapX(ele.x), y = mapY(ele.y);
        if (Math.abs(x) > 1E6 || Math.abs(y) > 1E6) {
          skipped = true;
          break;
        }
        var nxtp = x + "," + y + " ";

        if (focus.yl <= ele.y && ele.y <= focus.yr) {
          _(eleprops[i]).extend({
            "cx" : x,
            "cy" : y,
            "t_x" : x,
            "t_y" : y,
            "op" : scope.tips[eleprops[i].id] == null ? 0 : 1
          });
          this.resppipe.push(eleprops[i]);
        }

        if (i < this.vindexR) {
          if (this.interpolation === "none") {
            var ele2 = eles[i + 1];
            nxtp += mapX(ele.x) + "," + mapY(ele.y) + " " + mapX(ele2.x) + "," + mapY(ele.y) + " ";
          } else if (this.interpolation === "curve") {
            // TODO curve implementation
          }
        }
        pstr += nxtp;
      }

      if (skipped === true) {
        console.error("data not shown due to too large coordinate");
      }
      if (pstr.length > 0) {
        this.itemProps.d = pstr;
      }
    };

    PlotLine.prototype.prepareOnDemand = function(scope) {
      var focus = scope.focus;
      var eles = this.elements,
          eleprops = this.elementProps;
      var mapX = scope.data2scrX,
          mapY = scope.data2scrY;
      var pstr = "", skipped = false;

      this.resppipe.length = 0;
      this.elementProps.length = 0;

      for (var i = this.vindexL; i <= this.vindexR; i++) {
        var ele = eles[i];
        if (i === this.vindexL) {
          pstr += "M";
        } else if (i === this.vindexL + 1) {
          if (this.interpolation !== "curve") pstr += "L";
          else pstr += "C";
        }
        var x = mapX(ele.x), y = mapY(ele.y);
        if (Math.abs(x) > 1E6 || Math.abs(y) > 1E6) {
          skipped = true;
          break;
        }
        var nxtp = x + "," + y + " ";

        if (focus.yl <= ele.y && ele.y <= focus.yr) {
          var id = this.id + "_" + i;
          var prop = {
            "id" : id,
            "cls" : "plot-resp plot-respdot",
            "isresp" : true,
            "r" : 5,
            "cx" : x,
            "cy" : y,
            "t_x" : x,
            "t_y" : y,
            "t_txt" : this.createTip(ele),
            "t_clr" : this.color == null ? "gray" : this.color,
            "op" : scope.tips[id] == null ? 0 : 1
          };
          eleprops.push(prop);
          this.resppipe.push(prop);
        }

        if (i < this.vindexR) {
          if (this.interpolation === "none") {
            var ele2 = eles[i + 1];
            nxtp += mapX(ele.x) + "," + mapY(ele.y) + " " + mapX(ele2.x) + "," + mapY(ele.y) + " ";
          } else if (this.interpolation === "curve") {
            // TODO curve implementation
          }
        }
        pstr += nxtp;
      }

      if (skipped === true) {
        console.error("data not shown due to too large coordinate");
      }
      if (pstr.length > 0) {
        this.itemProps.d = pstr;
      }
    };

    PlotLine.prototype.draw = function(scope) {
      var svg = scope.maing;
      var props = this.itemProps,
          eleprops = this.elementProps,
          resppipe = this.resppipe;

      if (svg.select("#" + this.id).empty()) {
        svg.selectAll("g")
          .data([props], function(d){ return d.id; }).enter().append("g")
          .attr("id", function(d) { return d.id; });
      }

      var itemsvg = svg.select("#" + this.id);

      itemsvg.selectAll("path")
        .data([props]).enter().append("path")
        .attr("class", function(d) { return d.cls; })
        .style("stroke", function(d) { return d.st; })
        .style("stroke-dasharray", function(d) { return d.st_da; })
        .style("stroke-width", function(d) { return d.st_w; })
        .style("stroke-opacity", function(d) { return d.st_op; });
      itemsvg.select("path")
        .attr("d", props.d);

      if (scope.stdmodel.useToolTip === true) {
        itemsvg.selectAll("circle")
          .data(resppipe, function(d) { return d.id; }).exit().remove();
        itemsvg.selectAll("circle")
          .data(resppipe, function(d) { return d.id; }).enter().append("circle")
          .attr("id", function(d) { return d.id; })
          .attr("class", function(d) { return d.cls; })
          .style("stroke", function(d) { return d.t_clr; });
        itemsvg.selectAll("circle")
          .data(resppipe, function(d) { return d.id; })
          .attr("cx", function(d) { return d.cx; })
          .attr("cy", function(d) { return d.cy; })
          .attr("r", function(d) { return d.r; })
          .style("opacity", function(d) { return d.op; });
      }
    };

    PlotLine.prototype.clear = function(scope) {
      scope.maing.select("#" + this.id).remove();
    };

    return PlotLine;
  };
  beaker.bkoFactory('PlotLine', ['plotUtils', 'PlotSampler', retfunc]);
})();