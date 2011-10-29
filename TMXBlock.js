/**
 * ChesterGL - Simple 2D WebGL demo/library
 *
 * Copyright (c) 2010-2011 Rolando Abarca
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 */

(function (window) {
	var ChesterGL = window['ChesterGL'];
	
	/**
	 * unpacks a UInt32 from a string
	 * @ignore
	 */
	function unpackUInt32(buffer, offset) {
		return ((buffer.charCodeAt(offset + 3) & 0xff) << 24 |
				(buffer.charCodeAt(offset + 2) & 0xff) << 16 |
				(buffer.charCodeAt(offset + 1) & 0xff) <<  8 |
				(buffer.charCodeAt(offset + 0) & 0xff));
	}
	
	/**
	 * @ignore
	 * 
	 * @param {string} path
	 * @param {string} data
	 * @param {function(boolean)=} callback
	 */
	function handleLoadTMX(path, data, callabck) {
		console.log("tmx loaded: " + path);
		
		var tmx = ChesterGL.assets['tmx'][path];
		tmx.data = data;
		callabck && callabck(true);
	}
	
	/**
	 * @name TMXBlock
	 * @class
	 * @constructor
	 * @extends ChesterGL.Block
	 */
	var TMXBlock = function () {};
	
	/**
	 * The size (in pixels) of the tiles (in the texture)
	 * 
	 * @type {Object.<string,number>}
	 */
	TMXBlock.prototype.tileSize = {
		'w': 0,
		'h': 0
	};
	
	/**
	 * The tile size in the map
	 * @type {Object.<string,number>}
	 */
	TMXBlock.prototype.mapTileSize = {
		'w': 0,
		'h': 0
	};
	
	/**
	 * @type {number}
	 */
	TMXBlock.prototype.totalTiles = 0;
	
	/**
	 * @type {number}
	 */
	TMXBlock.prototype.spacing = 0;
	
	/**
	 * @type {number}
	 */
	TMXBlock.prototype.margin = 0;
	
	/**
	 * @type {Array}
	 */
	TMXBlock.prototype.layers = null;
		
	// TMXBlock inherits from Block
	ChesterGL.extend(TMXBlock.prototype, ChesterGL.Block.prototype);
	
	/**
	 * @type {Object.<string,ChesterGL.Block>}
	 */
	TMXBlock.maps = {};
	
	/**
	 * @param {string} path
	 */
	TMXBlock.loadTMX = function(path) {
		ChesterGL.loadAsset('tmx', {path:path, dataType: 'xml'}, function (data) {
			var tmx = new ChesterGL.Block();
			/** @ignore */
			tmx.render = function () {};
			
			var map = $(data).find("map");
			var tileset = map.find("tileset").first();
			var orientation = map.attr("orientation");
			if (tileset) {
				tmx.tileSize = vec2.create([
					parseInt(tileset.attr("tilewidth"), 10),
					parseInt(tileset.attr("tileheight"), 10)
				]);
				tmx.mapTileSize = vec2.create([
					parseInt(map.attr("tilewidth"), 10),
					parseInt(map.attr("tileheight"), 10)
				]);
				if (tileset.attr("spacing")) {
					tmx.spacing = parseInt(tileset.attr("spacing"), 10);
				}
				if (tileset.attr("margin")) {
					tmx.margin = parseInt(tileset.attr("margin"), 10);
				}
				
				// find the image for the tileset
				var image = tileset.find("image").first();
				var imageSize = vec2.create([
					parseInt(image.attr("width"), 10),
					parseInt(image.attr("height"), 10)
				]);
				tmx.texture = image.attr('source');
				ChesterGL.loadAsset('texture', tmx.texture);
				
				// parse the layers
				tmx.layers = [];
				map.find("layer").each(function (i, layer) {
					var blockLayer = new ChesterGL.Block();
					/** @ignore */
					blockLayer.render = function () {};
					
					var layerSize = vec2.create([
						parseInt($(layer).attr("width"), 10),
						parseInt($(layer).attr("height"), 10)
					]);
					var data = $(layer).find("data").first();
					if (data) {
						if (data.attr("encoding") != "base64" || data.attr("compression")) {
							throw "Invalid TMX Data"
						}
						var str = data.text().trim();
						var decodedData = base64.decode(str);
						// fun begins here
						var offset = 0;
						for (var row = 0; row < layerSize[1]; row++) {
							for (var col = 0; col < layerSize[0]; col++) {
								var gid = unpackUInt32(decodedData, offset) - 1;
								var b = new ChesterGL.Block();
								var margin = tmx.margin || 0;
								var spacing = tmx.spacing || 0;
								var tileSize = tmx.tileSize;
								var mapTileSize = tmx.mapTileSize;
								
								b.setTexture(tmx.texture);
								var max_x = parseInt((imageSize[0] - margin * 2 + spacing) / (tileSize[0] + spacing), 10);
								var frame = quat4.create([
									// assume gid == 1
									(gid % max_x) * (tileSize[0] + spacing) + margin,
									(imageSize[1] - tileSize[1] - margin - spacing) - parseInt(gid / max_x, 10) * (tileSize[1] + spacing) + margin,
									tileSize[0],
									tileSize[1]
								]);
								// console.log("gid " + col + "," + row + ": " + gid + "; frame: " + frame.l + "," + frame.t);
								b.setFrame(frame);
								var bx, by;
								if (orientation == "orthogonal") {
									bx = col * mapTileSize[0]                     + tileSize[0]/2;
									by = (layerSize[1] - row - 1) * mapTileSize[1] + tileSize[1]/2;
								} else if (orientation == "isometric") {
									bx = mapTileSize[0]/2 * (layerSize[0] + col - row - 1)       + tileSize[0]/2;
									by = mapTileSize[1]/2 * ((layerSize[1] * 2 - col - row) - 2) + tileSize[1]/2;
								} else {
									throw "Invalid orientation";
								}
								b.moveTo([bx, by, 0]);                            
								blockLayer.addChild(b);
								offset += 4;
							}
						}
					} else {
						throw "No data for layer!"
					}
					tmx.addChild(blockLayer);
				}); // each layer
			} // if tileset
			TMXBlock.maps[path] = tmx;
		});
	};
		
	// just register a dummy handler
	ChesterGL.registerAssetHandler('tmx', handleLoadTMX);
	
	// export symbols
	TMXBlock['loadTMX'] = TMXBlock.loadTMX;
	
	window['ChesterGL']['TMXBlock'] = TMXBlock;
})(window);