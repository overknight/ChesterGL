/*
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
	 * creates a new block group
	 * 
	 * @constructor
	 * @extends ChesterGL.Block
	 * @param {string} texture An optional texture that will be shared with all children
	 * @param {number=} noChildren The optional initial number of maxChidlren. Defaults to 10
	 */
	ChesterGL.BlockGroup = function (texture, noChildren) {
		if (!ChesterGL.webglMode) {
			throw "BlockGroup only works on WebGL mode";
		}
		this.type = ChesterGL.Block.TYPE.BLOCKGROUP;
		this.children = [];
		if (texture) {
			this.texture = texture;
			this.program = ChesterGL.Block.PROGRAM.TEXTURE;
		} else {
			this.program = ChesterGL.Block.PROGRAM.DEFAULT;
		}
		this.setColor([1, 1, 1, 1]);
		
		this.maxChildren = noChildren || 10;
		
		// same as block, but multiplied by the number of totalChildren (plus index data)
		var gl = ChesterGL.gl;
		this.glBuffer        = gl.createBuffer();
		this.glBufferData    = new Float32Array(ChesterGL.Block.QUAD_SIZE * this.maxChildren);
		this.indexBuffer     = gl.createBuffer();
		this.indexBufferData = new Uint16Array(6 * this.maxChildren);
		
		this.mvMatrix = mat4.create();
		mat4.identity(this.mvMatrix);
	}
	
	/**
	 * extend from Block
	 * @ignore
	 */
	ChesterGL.BlockGroup.prototype = Object.create(ChesterGL.Block.prototype)
	
	/**
	 * The max number of children this blockgroup can hold (this is here for the buffer data)
	 * @type {number}
	 */
	ChesterGL.BlockGroup.prototype.maxChildren = 0;
	
	/**
	 * @type {boolean}
	 */
	ChesterGL.BlockGroup.prototype.isChildDirty = false;
			
	/**
	 * @type {?WebGLBuffer}
	 */
	ChesterGL.BlockGroup.prototype.indexBuffer = null;
	
	/**
	 * @type {?Uint16Array}
	 */
	ChesterGL.BlockGroup.prototype.indexBufferData = null;
	
	/**
	 * creates a block that can be added to this block group
	 * @param {quat4} rect
	 */
	ChesterGL.BlockGroup.prototype.createBlock = function (rect) {
		var b = new ChesterGL.Block(rect, ChesterGL.Block.TYPE.STANDALONE, this);
		if (this.texture) {
			b.setTexture(this.texture);
		}
		return b;
	},
	
	/**
	 * adds a child
	 * @param {ChesterGL.Block} block
	 */
	ChesterGL.BlockGroup.prototype.addChild = function (block) {
		if (this.children.length >= this.maxChildren) {
			throw "Error: too many children - Make the initial size of the BlockGroup larger"
		}
		if (!this.texture) {
			this.texture = block.texture;
		} else {
			if (this.texture != block.texture) {
				throw "Invalid child: only can add child with the same texture";
			}
		}
		if (block.parent != this) {
			throw "Invalid child: can only add children created with BlockGroup.create";
		}
		this.children.push(block);
		
		var length = this.children.length;
		
		// just point the buffer data on the child and set the baseIndex
		block.baseBufferIndex = length-1;
		block.glBufferData    = this.glBufferData;			
		this.isChildDirty = true;
	},
	
	/**
	 * when the block list changes, the indices array must be recreated
	 * @param {number} startIdx
	 */
	ChesterGL.BlockGroup.prototype.recreateIndices = function (startIdx) {
		var lastIdx = (this.indexBufferData[startIdx*6 - 1] || -1) + 1;
		var total = Math.max(this.children.length, 1);
		for (var i = startIdx; i < total; i ++) {
			var idx = i*6;
			this.indexBufferData[idx + 0] = lastIdx    ; this.indexBufferData[idx + 1] = lastIdx + 1; this.indexBufferData[idx + 2] = lastIdx + 2;
			this.indexBufferData[idx + 3] = lastIdx + 2; this.indexBufferData[idx + 4] = lastIdx + 1; this.indexBufferData[idx + 5] = lastIdx + 3;
			lastIdx += 4;
		}
		var gl = ChesterGL.gl;
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indexBufferData, gl.STATIC_DRAW);
	},
	
	/**
	 * removes a block from the group
	 * @param {ChesterGL.Block} b
	 */
	ChesterGL.BlockGroup.prototype.removeBlock = function (b) {
		throw "not implemented";
	},
	
	/**
	 * where the fun begins
	 */
	ChesterGL.BlockGroup.prototype.visit = function () {
		if (this.update) {
			this.update();
		}
		if (!this.visible) {
			return;
		}
		this.transform();
		
		// this should be more like cocos2d: preserve the z-ordering
		var children = this.children;
		var len = children.length;
		for (var i=0; i < len; i++) {
			children[i].visit();
		}
		
		// re-bind the glBuffer (might have changed in the children visit)
		var gl = ChesterGL.gl;
		gl.bindBuffer(gl.ARRAY_BUFFER, this.glBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, this.glBufferData, gl.STATIC_DRAW);
		
		if (this.isChildDirty) {
			this.recreateIndices(0);
			this.isChildDirty = false;
		}
		// render this block group
		this.render();
		
		// reset our dirty markers
		this.isFrameDirty = this.isColorDirty = this.isTransformDirty = false;
	},
	
	/**
	 * actually render the block group
	 */
	ChesterGL.BlockGroup.prototype.render = function () {
		var gl = ChesterGL.gl;
		
		// select current shader
		var program = ChesterGL.selectProgram(ChesterGL.Block.PROGRAM_NAME[this.program]);
		var totalChildren = this.children.length;
		var texOff = 3 * 4,
			colorOff = texOff + 2 * 4,
			stride = ChesterGL.Block.QUAD_SIZE;
		
		gl.uniform1f(program.opacityUniform, this.opacity);
		
		gl.bindBuffer(gl.ARRAY_BUFFER, this.glBuffer);
		
		gl.vertexAttribPointer(program.attribs['vertexPositionAttribute'], 3, gl.FLOAT, false, stride, 0);
		if (this.program == ChesterGL.Block.PROGRAM.DEFAULT) {
			// no extra attributes for the shader
		} else if (this.program == ChesterGL.Block.PROGRAM.TEXTURE) {
			var texture = ChesterGL.getAsset('texture', this.texture);
			
			// pass the texture attributes
			gl.vertexAttribPointer(program.attribs['textureCoordAttribute'], 2, gl.FLOAT, false, stride, texOff);
			
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, texture.tex);
			gl.uniform1i(program.samplerUniform, 0);				
		}
		gl.vertexAttribPointer(program.attribs['vertexColorAttribute'], 4, gl.FLOAT, false, stride, colorOff);
		
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
		gl.uniformMatrix4fv(program.mvMatrixUniform, false, this.mvMatrix);
		// gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4 * this.children.length);
		gl.drawElements(gl.TRIANGLES, totalChildren * 6, gl.UNSIGNED_SHORT, 0);
	}
		
	// inherit everything from Block
	// ChesterGL.extend(ChesterGL.BlockGroup.prototype, ChesterGL.Block.prototype);
	
	// export the symbol
	ChesterGL['BlockGroup'] = ChesterGL.BlockGroup;
})(window);
