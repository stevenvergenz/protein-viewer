// Copyright (c) 2013 Fabrice Robinet
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
//
//  * Redistributions of source code must retain the above copyright
//    notice, this list of conditions and the following disclaimer.
//  * Redistributions in binary form must reproduce the above copyright
//    notice, this list of conditions and the following disclaimer in the
//    documentation and/or other materials provided with the distribution.
//
//  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
// AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
// IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
// ARE DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> BE LIABLE FOR ANY
// DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
// (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
// LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
// ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
// THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

/*
	The Abstract Loader has two modes:
		#1: [static] load all the JSON at once [as of now]
		#2: [stream] stream and parse JSON progressively [not yet supported]

	Whatever is the mechanism used to parse the JSON (#1 or #2),
	The loader starts by resolving the paths to binaries and referenced json files (by replace the value of the path property with an absolute path if it was relative).

	In case #1: it is guaranteed to call the concrete loader implementation methods in a order that solves the dependencies between the entries.
	only the nodes requires an extra pass to set up the hirerarchy.
	In case #2: the concrete implementation will have to solve the dependencies. no order is guaranteed.

	When case #1 is used the followed dependency order is:

	scenes -> nodes -> meshes -> materials -> techniques -> shaders
					-> buffers
					-> cameras
					-> lights

	The readers starts with the leafs, i.e:
		shaders, techniques, materials, meshes, buffers, cameras, lights, nodes, scenes

	For each called handle method called the client should return true if the next handle can be call right after returning,
	or false if a callback on client side will notify the loader that the next handle method can be called.

*/
var global = window;
(function (root, factory) {
	if (typeof exports === 'object') {
		// Node. Does not work with strict CommonJS, but
		// only CommonJS-like enviroments that support module.exports,
		// like Node.
		factory(module.exports);
	} else if (typeof define === 'function' && define.amd) {
		// AMD. Register as an anonymous module.
		define([], function () {
			return factory(root);
		});
	} else {
		// Browser globals
		factory(root);
	}
}(this, function (root) {
	"use strict";

	var categoriesDepsOrder = ["extensions", "buffers", "bufferViews", "images",  "videos", "samplers", "textures", "shaders", "programs", "techniques", "materials", "accessors", "meshes", "cameras", "lights", "skins", "nodes", "animations", "scenes"];

	var glTFParser = Object.create(Object.prototype, {

		_rootDescription: { value: null, writable: true },

		rootDescription: {
			set: function(value) {
				this._rootDescription = value;
			},
			get: function() {
				return this._rootDescription;
			}
		},

		baseURL: { value: null, writable: true },

		//detect absolute path following the same protocol than window.location
		_isAbsolutePath: {
			value: function(path) {
				var isAbsolutePathRegExp = new RegExp("^"+window.location.protocol, "i");

				return path.match(isAbsolutePathRegExp) ? true : false;
			}
		},

		resolvePathIfNeeded: {
			value: function(path) {
				if (this._isAbsolutePath(path)) {
					return path;
				}

				var isDataUriRegex = /^data:/;
				if (isDataUriRegex.test(path)) {
					return path;
				}
				
				return this.baseURL + path;
			}
		},

		_resolvePathsForCategories: {
			value: function(categories) {
				categories.forEach( function(category) {
					var descriptions = this.json[category];
					if (descriptions) {
						var descriptionKeys = Object.keys(descriptions);
						descriptionKeys.forEach( function(descriptionKey) {
							var description = descriptions[descriptionKey];
							description.uri = this.resolvePathIfNeeded(description.uri);
						}, this);
					}
				}, this);
			}
		},

		_json: {
			value: null,
			writable: true
		},

		json: {
			enumerable: true,
			get: function() {
				return this._json;
			},
			set: function(value) {
				if (this._json !== value) {
					this._json = value;
					this._resolvePathsForCategories(["buffers", "shaders", "images", "videos"]);
				}
			}
		},

		_path: {
			value: null,
			writable: true
		},

		getEntryDescription: {
			value: function (entryID, entryType) {
				var entries = null;

				var category = entryType;
				entries = this.rootDescription[category];
				if (!entries) {
					console.log("ERROR:CANNOT find expected category named:"+category);
					return null;
				}

				return entries ? entries[entryID] : null;
			}
		},

		_stepToNextCategory: {
			value: function() {
				this._state.categoryIndex = this.getNextCategoryIndex(this._state.categoryIndex + 1);
				if (this._state.categoryIndex !== -1) {
					this._state.categoryState.index = 0;
					return true;
				}

				return false;
			}
		},

		_stepToNextDescription: {
			enumerable: false,
			value: function() {
				var categoryState = this._state.categoryState;
				var keys = categoryState.keys;
				if (!keys) {
					console.log("INCONSISTENCY ERROR");
					return false;
				}

				categoryState.index++;
				categoryState.keys = null;
				if (categoryState.index >= keys.length) {
					return this._stepToNextCategory();
				}
				return false;
			}
		},

		hasCategory: {
			value: function(category) {
				return this.rootDescription[category] ? true : false;
			}
		},

		_handleState: {
			value: function() {

				var methodForType = {
					"buffers" : this.handleBuffer,
					"bufferViews" : this.handleBufferView,
					"shaders" : this.handleShader,
					"programs" : this.handleProgram,
					"techniques" : this.handleTechnique,
					"materials" : this.handleMaterial,
					"meshes" : this.handleMesh,
					"cameras" : this.handleCamera,
					"lights" : this.handleLight,
					"nodes" : this.handleNode,
					"scenes" : this.handleScene,
					"images" : this.handleImage,
					"animations" : this.handleAnimation,
					"accessors" : this.handleAccessor,
					"skins" : this.handleSkin,
					"samplers" : this.handleSampler,
					"textures" : this.handleTexture,
					"videos" : this.handleVideo,
					"extensions" : this.handleExtension,

				};

				var success = true;
				while (this._state.categoryIndex !== -1) {
					var category = categoriesDepsOrder[this._state.categoryIndex];
					var categoryState = this._state.categoryState;
					var keys = categoryState.keys;
					if (!keys) {
						categoryState.keys = keys = Object.keys(this.rootDescription[category]);
						if (keys) {
							if (keys.length == 0) {
								this._stepToNextDescription();
								continue;
							}
						}
					}

					var type = category;
					var entryID = keys[categoryState.index];
					var description = this.getEntryDescription(entryID, type);
					if (!description) {
						if (this.handleError) {
							this.handleError("INCONSISTENCY ERROR: no description found for entry "+entryID);
							success = false;
							break;
						}
					} else {

						if (methodForType[type]) {
							if (methodForType[type].call(this, entryID, description, this._state.userInfo) === false) {
								success = false;
								break;
							}
						}

						this._stepToNextDescription();
					}
				}

				if (this.handleLoadCompleted) {
					this.handleLoadCompleted(success);
				}

			}
		},

		_loadJSONIfNeeded: {
			enumerable: true,
			value: function(callback) {
				var self = this;
				//FIXME: handle error
				if (!this._json)  {
					var jsonPath = this._path;
					var i = jsonPath.lastIndexOf("/");
					this.baseURL = (i !== 0) ? jsonPath.substring(0, i + 1) : '';
					var jsonfile = new XMLHttpRequest();
					jsonfile.open("GET", jsonPath, true);
					jsonfile.onreadystatechange = function() {
						if (jsonfile.readyState == 4) {
							if (jsonfile.status == 200) {
								self.json = JSON.parse(jsonfile.responseText);
								if (callback) {
									callback(self.json);
								}
							}
						}
					};
					jsonfile.send(null);
			   } else {
					if (callback) {
						callback(this.json);
					}
				}
			}
		},

		/* load JSON and assign it as description to the reader */
		_buildLoader: {
			value: function(callback) {
				var self = this;
				function JSONReady(json) {
					self.rootDescription = json;
					if (callback)
						callback(this);
				}

				this._loadJSONIfNeeded(JSONReady);
			}
		},

		_state: { value: null, writable: true },

		_getEntryType: {
			value: function(entryID) {
				var rootKeys = categoriesDepsOrder;
				for (var i = 0 ;  i < rootKeys.length ; i++) {
					var rootValues = this.rootDescription[rootKeys[i]];
					if (rootValues) {
						return rootKeys[i];
					}
				}
				return null;
			}
		},

		getNextCategoryIndex: {
			value: function(currentIndex) {
				for (var i = currentIndex ; i < categoriesDepsOrder.length ; i++) {
					if (this.hasCategory(categoriesDepsOrder[i])) {
						return i;
					}
				}

				return -1;
			}
		},

		load: {
			enumerable: true,
			value: function(userInfo, options) {
				var self = this;
				this._buildLoader(function loaderReady(reader) {
					var startCategory = self.getNextCategoryIndex.call(self,0);
					if (startCategory !== -1) {
						self._state = { "userInfo" : userInfo,
										"options" : options,
										"categoryIndex" : startCategory,
										"categoryState" : { "index" : "0" } };
						self._handleState();
					}
				});
			}
		},

		initWithPath: {
			value: function(path) {
				this._path = path;
				this._json = null;
				return this;
			}
		},

		//this is meant to be global and common for all instances
		_knownURLs: { writable: true, value: {} },

		//to be invoked by subclass, so that ids can be ensured to not overlap
		loaderContext: {
			value: function() {
				if (typeof this._knownURLs[this._path] === "undefined") {
					this._knownURLs[this._path] = Object.keys(this._knownURLs).length;
				}
				return "__" + this._knownURLs[this._path];
			}
		},

		initWithJSON: {
			value: function(json, baseURL) {
				this.json = json;
				this.baseURL = baseURL;
				if (!baseURL) {
					console.log("WARNING: no base URL passed to Reader:initWithJSON");
				}
				return this;
			}
		}

	});

	if(root) {
		root.glTFParser = glTFParser;
	}

	return glTFParser;

}));
/**
 * @author Tony Parisi / http://www.tonyparisi.com/
 */


THREE.glTFLoader = function () {

	this.meshesRequested = 0;
	this.meshesLoaded = 0;
	this.pendingMeshes = [];
	this.animationsRequested = 0;
	this.animationsLoaded = 0;
	this.animations = [];
	this.shadersRequested = 0;
	this.shadersLoaded = 0;
	this.shaders = {};
	this.loadRequests = [];
	THREE.glTFShaders.removeAll();
	THREE.Loader.call( this );
}

THREE.glTFLoader.prototype = new THREE.Loader();
THREE.glTFLoader.prototype.constructor = THREE.glTFLoader;

THREE.glTFLoader.prototype.load = function( url, callback ) {

	var theLoader = this;
	// Utilities

	function RgbArraytoHex(colorArray) {
		if(!colorArray) return 0xFFFFFFFF;
		var r = Math.floor(colorArray[0] * 255),
			g = Math.floor(colorArray[1] * 255),
			b = Math.floor(colorArray[2] * 255),
			a = 255;

		var color = (a << 24) + (r << 16) + (g << 8) + b;

		return color;
	}

	function componentsPerElementForGLType(type) {
		switch(type) {
			case "SCALAR" :
				nElements = 1;
				break;
			case "VEC2" :
				nElements = 2;
				break;
			case "VEC3" :
				nElements = 3;
				break;
			case "VEC4" :
				nElements = 4;
				break;
			case "MAT2" :
				nElements = 4;
				break;
			case "MAT3" :
				nElements = 9;
				break;
			case "MAT4" :
				nElements = 16;
				break;
			default :
				debugger;
				break;
		}

		return nElements;
	}

	function replaceShaderDefinitions(shader, material) {

		// Three.js seems too dependent on attribute names so globally
		// replace those in the shader code
		var program = material.params.program;
		var shaderParams = material.params.technique.parameters;
		var shaderAttributes = material.params.technique.attributes;
		var params = {};

		for (var attribute in material.params.attributes) {
			var pname = shaderAttributes[attribute];
			var shaderParam = shaderParams[pname];
			var semantic = shaderParam.semantic;
			if (semantic) {
				params[attribute] = shaderParam;
			}
		}


		var s = shader;
		var r = "";
		for (var pname in params) {
			var param = params[pname];
			var semantic = param.semantic;

			r = eval("/" + pname + "/g");

			switch (semantic) {
				case "POSITION" :
					s = s.replace(r, 'position');
					break;
				case "NORMAL" :
					s = s.replace(r, 'normal');
					break;
				case "TEXCOORD_0" :
					s = s.replace(r, 'uv');
					break;
			   case "WEIGHT" :
					s = s.replace(r, 'skinWeight');
					break;
				case "JOINT" :
					s = s.replace(r, 'skinIndex');
					break;
				default :
					break;
			}

		}

		return s;
	}

	function replaceShaderSemantics(material) {

		var vertexShader = theLoader.shaders[material.params.vertexShader];
		if (vertexShader) {
			vertexShader = replaceShaderDefinitions(vertexShader, material);
			theLoader.shaders[material.params.vertexShader] = vertexShader;
		}

	}

	function createShaderMaterial(material) {

		// replace named attributes and uniforms with Three.js built-ins
		replaceShaderSemantics(material);

		var fragmentShader = theLoader.shaders[material.params.fragmentShader];
		if (!fragmentShader) {
			console.log("ERROR: Missing fragment shader definition:", material.params.fragmentShader);
			return new THREE.MeshPhongMaterial;
		}

		var vertexShader = theLoader.shaders[material.params.vertexShader];
		if (!vertexShader) {
			console.log("ERROR: Missing vertex shader definition:", material.params.vertexShader);
			return new THREE.MeshPhongMaterial;
		}

		// clone most uniforms but then clobber textures, we want them to
		// be reused
		var uniforms = THREE.UniformsUtils.clone(material.params.uniforms);
		for (uniform in material.params.uniforms) {
			var src = material.params.uniforms[uniform];
			var dst = uniforms[uniform];
			if (dst.type == "t") {
				dst.value = src.value;
			}
		}

		var shaderMaterial = new THREE.RawShaderMaterial( {

			fragmentShader: fragmentShader,
			vertexShader: vertexShader,
			uniforms: uniforms,
			transparent: material.params.transparent,

		} );

//        console.log("New shader material")
		return shaderMaterial;
	}


	function LoadTexture(src) {
		if(!src) { return null; }

		var isDataUriRegex = /^data:/;

		var loadImage = function(url, success, error) {
			var image = new Image();

			image.onload = function() {
				success(image);
			};

			if (typeof error !== 'undefined') {
				image.onerror = error;
			}

			image.src = url;
		};

		function loadImageFromTypedArray(uint8Array, format) {
			//>>includeStart('debug', pragmas.debug);
			if (!defined(uint8Array)) {
				throw new DeveloperError('uint8Array is required.');
			}

			if (!defined(format)) {
				throw new DeveloperError('format is required.');
			}
			//>>includeEnd('debug');

			var blob = new Blob([uint8Array], {
				type : format
			});

		};

		function decodeDataUriText(isBase64, data) {
			var result = decodeURIComponent(data);
			if (isBase64) {
				return atob(result);
			}
			return result;
		}

		function decodeDataUriArrayBuffer(isBase64, data) {
			var byteString = decodeDataUriText(isBase64, data);
			var buffer = new ArrayBuffer(byteString.length);
			var view = new Uint8Array(buffer);
			for (var i = 0; i < byteString.length; i++) {
				view[i] = byteString.charCodeAt(i);
			}
			return buffer;
		}

		function decodeDataUri(dataUriRegexResult, responseType) {
			responseType = typeof responseType !== 'undefined' ? responseType : '';
			var mimeType = dataUriRegexResult[1];
			var isBase64 = !!dataUriRegexResult[2];
			var data = dataUriRegexResult[3];

			switch (responseType) {
			case '':
			case 'text':
				return decodeDataUriText(isBase64, data);
			case 'ArrayBuffer':
				return decodeDataUriArrayBuffer(isBase64, data);
			case 'blob':
				var buffer = decodeDataUriArrayBuffer(isBase64, data);
				return new Blob([buffer], {
					type : mimeType
				});
			case 'document':
				var parser = new DOMParser();
				return parser.parseFromString(decodeDataUriText(isBase64, data), mimeType);
			case 'json':
				return JSON.parse(decodeDataUriText(isBase64, data));
			default:
				throw 'Unhandled responseType: ' + responseType;
			}
		}

		var dataUriRegex = /^data:(.*?)(;base64)?,(.*)$/;
		var dataUriRegexResult = dataUriRegex.exec(src);
		if (dataUriRegexResult !== null) {
			var texture = new THREE.Texture;
			var blob = decodeDataUri(dataUriRegexResult, 'blob');
			var blobUrl = window.URL.createObjectURL(blob);
			loadImage(blobUrl, function(img) {
				texture.image = img;
				texture.needsUpdate = true;
			});
			return texture;
		}

		return new THREE.TextureLoader().load(src);
	}

	function CreateTexture(resources, resource) {
		var texturePath = null;
		var textureParams = null;

		if (resource)
		{
			var texture = resource;
			if (texture) {
				var textureEntry = resources.getEntry(texture);
				if (textureEntry) {
					{
						var imageEntry = resources.getEntry(textureEntry.description.source);
						if (imageEntry) {
							texturePath = imageEntry.description.uri;
						}

						var samplerEntry = resources.getEntry(textureEntry.description.sampler);
						if (samplerEntry) {
							textureParams = samplerEntry.description;
						}
					}
				}
			}
		}

		var texture = LoadTexture(texturePath);
		if (texture && textureParams) {

			if (textureParams.wrapS == WebGLRenderingContext.REPEAT)
				texture.wrapS = THREE.RepeatWrapping;

			if (textureParams.wrapT == WebGLRenderingContext.REPEAT)
				texture.wrapT = THREE.RepeatWrapping;

			if (textureParams.magFilter == WebGLRenderingContext.LINEAR)
				texture.magFilter = THREE.LinearFilter;

//                  if (textureParams.minFilter == "LINEAR")
//                      texture.minFilter = THREE.LinearFilter;
		}

		return texture;
	}

	// Geometry processing

	var ClassicGeometry = function() {

		this.geometry = new THREE.BufferGeometry;
		this.totalAttributes = 0;
		this.loadedAttributes = 0;
		this.indicesLoaded = false;
		this.finished = false;

		this.onload = null;

		this.uvs = null;
		this.indexArray = null;
	};

	ClassicGeometry.prototype.constructor = ClassicGeometry;

	ClassicGeometry.prototype.buildBufferGeometry = function() {
		// Build indexed mesh
		var geometry = this.geometry;
		geometry.setIndex(new THREE.BufferAttribute( this.indexArray, 1 ) );

		var offset = {
				start: 0,
				index: 0,
				count: this.indexArray.length
			};

		geometry.groups.push( offset );

		geometry.computeBoundingSphere();
	}

	ClassicGeometry.prototype.checkFinished = function() {
		if(this.indexArray && this.loadedAttributes === this.totalAttributes) {

			this.buildBufferGeometry();

			this.finished = true;

			if(this.onload) {
				this.onload();
			}
		}
	};

	// Delegate for processing index buffers
	var IndicesDelegate = function() {};

	IndicesDelegate.prototype.handleError = function(errorCode, info) {
		// FIXME: report error
		console.log("ERROR(IndicesDelegate):"+errorCode+":"+info);
	};

	IndicesDelegate.prototype.convert = function(resource, ctx) {
		return new Uint16Array(resource, 0, ctx.indices.count);
	};

	IndicesDelegate.prototype.resourceAvailable = function(glResource, ctx) {
		var geometry = ctx.geometry;
		geometry.indexArray = glResource;
		geometry.checkFinished();
		return true;
	};

	var indicesDelegate = new IndicesDelegate();

	var IndicesContext = function(indices, geometry) {
		this.indices = indices;
		this.geometry = geometry;
	};

	// Delegate for processing vertex attribute buffers
	var VertexAttributeDelegate = function() {};

	VertexAttributeDelegate.prototype.handleError = function(errorCode, info) {
		// FIXME: report error
		console.log("ERROR(VertexAttributeDelegate):"+errorCode+":"+info);
	};

	VertexAttributeDelegate.prototype.convert = function(resource, ctx) {
		return resource;
	};


	VertexAttributeDelegate.prototype.bufferResourceAvailable = function(glResource, ctx) {
		var geom = ctx.geometry;
		var attribute = ctx.attribute;
		var semantic = ctx.semantic;
		var floatArray;
		var i, l;
		var nComponents;
		//FIXME: Float32 is assumed here, but should be checked.

		if (semantic == "POSITION") {
			// TODO: Should be easy to take strides into account here
			floatArray = new Float32Array(glResource, 0, attribute.count * componentsPerElementForGLType(attribute.type));
			geom.geometry.addAttribute( 'position', new THREE.BufferAttribute( floatArray, 3 ) );
		} else if (semantic == "NORMAL") {
			nComponents = componentsPerElementForGLType(attribute.type);
			floatArray = new Float32Array(glResource, 0, attribute.count * nComponents);
			geom.geometry.addAttribute( 'normal', new THREE.BufferAttribute( floatArray, 3 ) );
		} else if ((semantic == "TEXCOORD_0") || (semantic == "TEXCOORD" )) {

			nComponents = componentsPerElementForGLType(attribute.type);
			floatArray = new Float32Array(glResource, 0, attribute.count * nComponents);
			// N.B.: flip Y value... should we just set texture.flipY everywhere?
			for (i = 0; i < floatArray.length / 2; i++) {
				floatArray[i*2+1] = 1.0 - floatArray[i*2+1];
			}
			geom.geometry.addAttribute( 'uv', new THREE.BufferAttribute( floatArray, nComponents ) );
		}
		else if (semantic == "WEIGHT") {
			nComponents = componentsPerElementForGLType(attribute.type);
			floatArray = new Float32Array(glResource, 0, attribute.count * nComponents);
			geom.geometry.addAttribute( 'skinWeight', new THREE.BufferAttribute( floatArray, nComponents ) );
		}
		else if (semantic == "JOINT") {
			nComponents = componentsPerElementForGLType(attribute.type);
			floatArray = new Float32Array(glResource, 0, attribute.count * nComponents);
			geom.geometry.addAttribute( 'skinIndex', new THREE.BufferAttribute( floatArray, nComponents ) );
		}
	}

	VertexAttributeDelegate.prototype.resourceAvailable = function(glResource, ctx) {

		this.bufferResourceAvailable(glResource, ctx);

		var geom = ctx.geometry;
		geom.loadedAttributes++;
		geom.checkFinished();
		return true;
	};

	var vertexAttributeDelegate = new VertexAttributeDelegate();

	var VertexAttributeContext = function(attribute, semantic, geometry) {
		this.attribute = attribute;
		this.semantic = semantic;
		this.geometry = geometry;
	};

	var Mesh = function() {
		this.primitives = [];
		this.materialsPending = [];
		this.loadedGeometry = 0;
		this.onCompleteCallbacks = [];
	};

	Mesh.prototype.addPrimitive = function(geometry, material) {

		var self = this;
		geometry.onload = function() {
			self.loadedGeometry++;
			self.checkComplete();
		};

		this.primitives.push({
			geometry: geometry,
			material: material,
			mesh: null
		});
	};

	Mesh.prototype.onComplete = function(callback) {
		this.onCompleteCallbacks.push(callback);
		//this.checkComplete();
	};

	Mesh.prototype.checkComplete = function() {
		var self = this;
		if(this.onCompleteCallbacks.length && this.primitives.length == this.loadedGeometry) {
			this.onCompleteCallbacks.forEach(function(callback) {
				callback(self);
			});
			this.onCompleteCallbacks = [];
		}
	};

	Mesh.prototype.attachToNode = function(threeNode) {
		// Assumes that the geometry is complete
		var that = this;
		this.primitives.forEach(function(primitive) {
			/*if(!primitive.mesh) {
				primitive.mesh = new THREE.Mesh(primitive.geometry, primitive.material);
			}*/
			var material = primitive.material;
			var materialParams = material.params;
			if (!(material instanceof THREE.Material)) {
				material = createShaderMaterial(material);
			}

			if (!that.skin) {
				// console.log ("New mesh")
				var threeMesh = new THREE.Mesh(primitive.geometry.geometry, material);
				threeMesh.castShadow = true;
				threeNode.add(threeMesh);

				if (material instanceof THREE.ShaderMaterial) {
					var glTFShader = new THREE.glTFShader(material, materialParams, threeMesh, theLoader.rootObj);
					THREE.glTFShaders.add(glTFShader);

				}
			}
		});
	};

	// Delayed-loaded material
	var Material = function(params) {
		this.params = params;
	};

	// Delegate for processing animation parameter buffers
	var AnimationParameterDelegate = function() {};

	AnimationParameterDelegate.prototype.handleError = function(errorCode, info) {
		// FIXME: report error
		console.log("ERROR(AnimationParameterDelegate):"+errorCode+":"+info);
	};

	AnimationParameterDelegate.prototype.convert = function(resource, ctx) {
		var parameter = ctx.parameter;

		var glResource = null;
		switch (parameter.type) {
			case "SCALAR" :
			case "VEC2" :
			case "VEC3" :
			case "VEC4" :
				glResource = new Float32Array(resource, 0, parameter.count * componentsPerElementForGLType(parameter.type));
				break;
			default:
				break;
		}

		return glResource;
	};

	AnimationParameterDelegate.prototype.resourceAvailable = function(glResource, ctx) {
		var animation = ctx.animation;
		var parameter = ctx.parameter;
		parameter.data = glResource;
		animation.handleParameterLoaded(parameter);
		return true;
	};

	var animationParameterDelegate = new AnimationParameterDelegate();

	var AnimationParameterContext = function(parameter, animation) {
		this.parameter = parameter;
		this.animation = animation;
	};

	// Animations
	var Animation = function() {

		// create Three.js keyframe here
		this.totalParameters = 0;
		this.loadedParameters = 0;
		this.parameters = {};
		this.finishedLoading = false;
		this.onload = null;

	};

	Animation.prototype.constructor = Animation;

	Animation.prototype.handleParameterLoaded = function(parameter) {
		this.parameters[parameter.name] = parameter;
		this.loadedParameters++;
		this.checkFinished();
	};

	Animation.prototype.checkFinished = function() {
		if(this.loadedParameters === this.totalParameters) {
			// Build animation
			this.finishedLoading = true;

			if (this.onload) {
				this.onload();
			}
		}
	};

	// Delegate for processing inverse bind matrices buffer
	var InverseBindMatricesDelegate = function() {};

	InverseBindMatricesDelegate.prototype.handleError = function(errorCode, info) {
		// FIXME: report error
		console.log("ERROR(InverseBindMatricesDelegate):"+errorCode+":"+info);
	};

	InverseBindMatricesDelegate.prototype.convert = function(resource, ctx) {
		var parameter = ctx.parameter;

		var glResource = null;
		switch (parameter.type) {
			case "MAT4" :
				glResource = new Float32Array(resource, 0, parameter.count * componentsPerElementForGLType(parameter.type));
				break;
			default:
				break;
		}

		return glResource;
	};

	InverseBindMatricesDelegate.prototype.resourceAvailable = function(glResource, ctx) {
		var skin = ctx.skin;
		skin.inverseBindMatrices = glResource;
		return true;
	};

	var inverseBindMatricesDelegate = new InverseBindMatricesDelegate();

	var InverseBindMatricesContext = function(param, skin) {
		this.parameter = param;
		this.skin = skin;
	};

	// Delegate for processing shaders from external files
	var ShaderDelegate = function() {};

	ShaderDelegate.prototype.handleError = function(errorCode, info) {
		// FIXME: report error
		console.log("ERROR(ShaderDelegate):"+errorCode+":"+info);
	};

	ShaderDelegate.prototype.convert = function(resource, ctx) {
		return resource;
	}

	ShaderDelegate.prototype.resourceAvailable = function(data, ctx) {
		theLoader.shadersLoaded++;
		theLoader.shaders[ctx.id] = data;
		return true;
	};

	var shaderDelegate = new ShaderDelegate();

	var ShaderContext = function(id, path) {
		this.id = id;
		this.uri = path;
	};

	// Resource management

	var ResourceEntry = function(entryID, object, description) {
		this.entryID = entryID;
		this.object = object;
		this.description = description;
	};

	var Resources = function() {
		this._entries = {};
	};

	Resources.prototype.setEntry = function(entryID, object, description) {
		if (!entryID) {
			console.error("No EntryID provided, cannot store", description);
			return;
		}

		if (this._entries[entryID]) {
			console.warn("entry["+entryID+"] is being overwritten");
		}

		this._entries[entryID] = new ResourceEntry(entryID, object, description );
	};

	Resources.prototype.getEntry = function(entryID) {
		return this._entries[entryID];
	};

	Resources.prototype.clearEntries = function() {
		this._entries = {};
	};

	LoadDelegate = function() {
	}

	LoadDelegate.prototype.loadCompleted = function(callback, obj) {
		callback.call(Window, obj);
	}

	// Loader

	var ThreeGLTFLoader = Object.create(glTFParser, {

		load: {
			enumerable: true,
			value: function(userInfo, options) {
				this.resources = new Resources();
				this.cameras = [];
				this.lights = [];
				this.animations = [];
				this.joints = {};
				THREE.GLTFLoaderUtils.init();
				glTFParser.load.call(this, userInfo, options);
			}
		},

		cameras: {
			enumerable: true,
			writable: true,
			value : []
		},

		lights: {
			enumerable: true,
			writable: true,
			value : []
		},

		animations: {
			enumerable: true,
			writable: true,
			value : []
		},

		// Implement WebGLTFLoader handlers

		handleBuffer: {
			value: function(entryID, description, userInfo) {
				this.resources.setEntry(entryID, null, description);
				description.type = "ArrayBuffer";
				return true;
			}
		},

		handleBufferView: {
			value: function(entryID, description, userInfo) {
				this.resources.setEntry(entryID, null, description);

				var buffer =  this.resources.getEntry(description.buffer);
				description.type = "ArrayBufferView";

				var bufferViewEntry = this.resources.getEntry(entryID);
				bufferViewEntry.buffer = buffer;
				return true;
			}
		},

		handleShader: {
			value: function(entryID, description, userInfo) {
				this.resources.setEntry(entryID, null, description);
				var shaderRequest = {
						id : entryID,
						uri : description.uri,
				};

				var shaderContext = new ShaderContext(entryID, description.uri);

				theLoader.shadersRequested++;
				THREE.GLTFLoaderUtils.getFile(shaderRequest, shaderDelegate, shaderContext);

				return true;
			}
		},

		handleProgram: {
			value: function(entryID, description, userInfo) {
				this.resources.setEntry(entryID, null, description);
				return true;
			}
		},

		handleTechnique: {
			value: function(entryID, description, userInfo) {
				description.refCount = 0;
				this.resources.setEntry(entryID, null, description);
				return true;
			}
		},


		createShaderParams : {
			value: function(materialId, values, params, programID, technique) {
				var program = this.resources.getEntry(programID);

				params.uniforms = {};
				params.attributes = {};
				params.program = program;
				params.technique = technique;
				if (program) {
					params.fragmentShader = program.description.fragmentShader;
					params.vertexShader = program.description.vertexShader;
					for (var uniform in technique.uniforms) {
						var pname = technique.uniforms[uniform];
						var shaderParam = technique.parameters[pname];
						var ptype = shaderParam.type;
						var pcount = shaderParam.count;
						var value = values[pname];
						var utype = "";
						var uvalue;
						var ulength;

						// THIS: for (n in WebGLRenderingContext) { z = WebGLRenderingContext[n]; idx[z] = n; }
						//console.log("shader uniform param type: ", ptype, "-", theLoader.idx[ptype])


						switch (ptype) {
							case WebGLRenderingContext.FLOAT :
								utype = "f";
								uvalue = shaderParam.value;
								if (pname == "transparency") {
									var USE_A_ONE = true; // for now, hack because file format isn't telling us
									var opacity =  USE_A_ONE ? value : (1.0 - value);
									uvalue = opacity;
									params.transparent = true;
								}
								break;
							case WebGLRenderingContext.FLOAT_VEC2 :
								utype = "v2";
								uvalue = new THREE.Vector2;
								if (shaderParam && shaderParam.value) {
									var v2 = shaderParam.value;
									uvalue.fromArray(v2);
								}
								if (value) {
									uvalue.fromArray(value);
								}
								break;
							case WebGLRenderingContext.FLOAT_VEC3 :
								utype = "v3";
								uvalue = new THREE.Vector3;
								if (shaderParam && shaderParam.value) {
									var v3 = shaderParam.value;
									uvalue.fromArray(v3);
								}
								if (value) {
									uvalue.fromArray(value);
								}
								break;
							case WebGLRenderingContext.FLOAT_VEC4 :
								utype = "v4";
								uvalue = new THREE.Vector4;
								if (shaderParam && shaderParam.value) {
									var v4 = shaderParam.value;
									uvalue.fromArray(v4);
								}
								if (value) {
									uvalue.fromArray(value);
								}
								break;
							case WebGLRenderingContext.FLOAT_MAT2 :
								// what to do?
								console.log("Warning: FLOAT_MAT2");
								break;
							case WebGLRenderingContext.FLOAT_MAT3 :
								utype = "m3";
								uvalue = new THREE.Matrix3;
								if (shaderParam && shaderParam.value) {
									var m3 = shaderParam.value;
									uvalue.fromArray(m3);
								}
								if (value) {
									uvalue.fromArray(value);
								}
								break;
							case WebGLRenderingContext.FLOAT_MAT4 :
								if (pcount !== undefined) {
									utype = "m4v";
									uvalue = new Array(pcount);
									for (var mi = 0; mi < pcount; mi++) {
										uvalue[mi] = new THREE.Matrix4;
									}
									ulength = pcount;

									if (shaderParam && shaderParam.value) {
										var m4v = shaderParam.value;
										uvalue.fromArray(m4v);
									}
									if (value) {
										uvalue.fromArray(value);

									}
								}
								else {
									utype = "m4";
									uvalue = new THREE.Matrix4;

									if (shaderParam && shaderParam.value) {
										var m4 = shaderParam.value;
										uvalue.fromArray(m4);
									}
									if (value) {
										uvalue.fromArray(value);

									}
								}
								break;
							case WebGLRenderingContext.SAMPLER_2D :
								utype = "t";
								uvalue = value ? CreateTexture(this.resources, value) : null;
								break;
							default :
								throw new Error("Unknown shader uniform param type: " + ptype + " - " + theLoader.idx[ptype]);

								break;
						}


						var udecl = { type : utype, value : uvalue, length : ulength };

						params.uniforms[uniform] = udecl;
					}

					for (var attribute in technique.attributes) {
						var pname = technique.attributes[attribute];
						var param = technique.parameters[pname];
						var atype = param.type;
						var semantic = param.semantic;
						var adecl = { type : atype, semantic : semantic };

						params.attributes[attribute] = adecl;
					}

				}
			}
		},

		threeJSMaterialType : {
			value: function(materialId, material, params) {

				var extensions = material.extensions;
				var khr_material = extensions ? extensions.KHR_materials_common : null;

				var materialType = null;
				var values;

				if (khr_material) {

					switch (khr_material.technique)
					{
						case 'BLINN' :
						case 'PHONG' :
							materialType = THREE.MeshPhongMaterial;
							break;

						case 'LAMBERT' :
							materialType = THREE.MeshLambertMaterial;
							break;

						case 'CONSTANT' :
						default :
							materialType = THREE.MeshBasicMaterial;
							break;
					}

					if (khr_material.doubleSided)
					{
						params.side = THREE.DoubleSide;
					}

					if (khr_material.transparent)
					{
						params.transparent = true;
					}

					values = {};
					for (prop in khr_material.values) {
						values[prop] = khr_material.values[prop];
					}

				}
				else {
					var technique = material.technique ?
						this.resources.getEntry(material.technique) :
						null;

					values = material.values;
					var description = technique.description;

					if (++description.refCount > 1) {
						//console.log("refcount", description.refCount);
					}

					var programID = description.program;
					this.createShaderParams(materialId, values, params, programID, description);

					var loadshaders = true;

					if (loadshaders) {
						materialType = Material;
					}
				}

				if (values.diffuse && typeof(values.diffuse) == 'string') {
					params.map = CreateTexture(this.resources, values.diffuse);
				}
				if (values.reflective && typeof(values.reflective) == 'string') {
					params.envMap = CreateTexture(this.resources, values.reflective);
				}

				var shininess = values.shininesss || values.shininess; // N.B.: typo in converter!
				if (shininess)
				{
					shininess = shininess;
				}

				var diffuseColor = null;
				if (!params.map) {
					diffuseColor = values.diffuse;
				}
				var opacity = 1.0;
				if (values.hasOwnProperty("transparency"))
				{
					var USE_A_ONE = true; // for now, hack because file format isn't telling us
					opacity =  USE_A_ONE ? values.transparency : (1.0 - values.transparency);
				}

				// if (diffuseColor) diffuseColor = [0, 1, 0];

				params.color = RgbArraytoHex(diffuseColor);
				params.opacity = opacity;
				params.transparent = opacity < 1.0;
				// hack hack hack
				if (params.map && params.map.sourceFile.toLowerCase().indexOf(".png") != -1)
					params.transparent = true;

				if (!(shininess === undefined))
				{
					params.shininess = Math.max( shininess, 1e-4 );
				}

				delete params.ambient;
				if (!(values.ambient === undefined) && !(typeof(values.ambient) == 'string'))
				{
					//params.ambient = RgbArraytoHex(values.ambient);
				}

				if (!(values.emission === undefined))
				{
					params.emissive = RgbArraytoHex(values.emission);
				}

				if (!(values.specular === undefined))
				{
					params.specular = RgbArraytoHex(values.specular);
				}

				return materialType;

			}
		},

		handleMaterial: {
			value: function(entryID, description, userInfo) {
				var params = {};

				var materialType = this.threeJSMaterialType(entryID, description, params);

				var material = new materialType(params);

				this.resources.setEntry(entryID, material, description);

				return true;
			}
		},

		handleMesh: {
			value: function(entryID, description, userInfo) {
				var mesh = new Mesh();
				this.resources.setEntry(entryID, mesh, description);
				var primitivesDescription = description.primitives;
				if (!primitivesDescription) {
					//FIXME: not implemented in delegate
					console.log("MISSING_PRIMITIVES for mesh:"+ entryID);
					return false;
				}

				for (var i = 0 ; i < primitivesDescription.length ; i++) {
					var primitiveDescription = primitivesDescription[i];

					if (primitiveDescription.mode === WebGLRenderingContext.TRIANGLES) {

						var geometry = new ClassicGeometry();
						var materialEntry = this.resources.getEntry(primitiveDescription.material);

						mesh.addPrimitive(geometry, materialEntry.object);

						var allAttributes = Object.keys(primitiveDescription.attributes);

						// count them first, async issues otherwise
						allAttributes.forEach( function(semantic) {
							geometry.totalAttributes++;
						}, this);

						var indices = this.resources.getEntry(primitiveDescription.indices);
						var bufferEntry = this.resources.getEntry(indices.description.bufferView);
						var indicesObject = {
								bufferView : bufferEntry,
								byteOffset : indices.description.byteOffset,
								count : indices.description.count,
								id : indices.entryID,
								componentType : indices.description.componentType,
								type : indices.description.type
						};

						var indicesContext = new IndicesContext(indicesObject, geometry);
						var loaddata = {
							indicesObject : indicesObject,
							indicesDelegate : indicesDelegate,
							indicesContext : indicesContext
						};

						theLoader.scheduleLoad(function(data) {
							var alreadyProcessedIndices =
								THREE.GLTFLoaderUtils.getBuffer(data.indicesObject,
									data.indicesDelegate, data.indicesContext);

							if (alreadyProcessedIndices) {
								data.indicesDelegate.resourceAvailable(
									alreadyProcessedIndices, data.indicesContext);
							}

						}, loaddata);

						// Load Vertex Attributes
						allAttributes.forEach( function(semantic) {

							var attribute;
							var attributeID = primitiveDescription.attributes[semantic];
							var attributeEntry = this.resources.getEntry(attributeID);
							if (!attributeEntry) {
								//let's just use an anonymous object for the attribute
								attribute = description.attributes[attributeID];
								attribute.id = attributeID;
								this.resources.setEntry(attributeID, attribute, attribute);

								var bufferEntry = this.resources.getEntry(attribute.bufferView);
								attributeEntry = this.resources.getEntry(attributeID);

							} else {
								attribute = attributeEntry.object;
								attribute.id = attributeID;
								var bufferEntry = this.resources.getEntry(attribute.bufferView);
							}

							var attributeObject = {
									bufferView : bufferEntry,
									byteOffset : attribute.byteOffset,
									byteStride : attribute.byteStride,
									count : attribute.count,
									max : attribute.max,
									min : attribute.min,
									componentType : attribute.componentType,
									type : attribute.type,
									id : attributeID
							};

							var attribContext = new VertexAttributeContext(attributeObject, semantic, geometry);

							var loaddata = {
								attributeObject : attributeObject,
								vertexAttributeDelegate : vertexAttributeDelegate,
								attribContext : attribContext
							};

							theLoader.scheduleLoad(function(data) {
								var alreadyProcessedAttribute =
									THREE.GLTFLoaderUtils.getBuffer(data.attributeObject,
										data.vertexAttributeDelegate, data.attribContext);

								if (alreadyProcessedAttribute) {
									data.vertexAttributeDelegate.resourceAvailable(
										alreadyProcessedAttribute, data.attribContext);
								}

							}, loaddata);


						}, this);
					}
				}
				return true;
			}
		},

		handleCamera: {
			value: function(entryID, description, userInfo) {
				var camera;
				if (description.type == "perspective")
				{
					var znear = description.perspective.znear;
					var zfar = description.perspective.zfar;
					var yfov = description.perspective.yfov;
					var xfov = description.perspective.xfov;
					var aspect_ratio = description.perspective.aspect_ratio;

					if (!aspect_ratio)
						aspect_ratio = 1;

					if (xfov === undefined) {
						if (yfov)
						{
							// According to COLLADA spec...
							// aspect_ratio = xfov / yfov
							xfov = yfov * aspect_ratio;
						}
					}

					if (yfov === undefined)
					{
						if (xfov)
						{
							// According to COLLADA spec...
							// aspect_ratio = xfov / yfov
							yfov = xfov / aspect_ratio;
						}

					}

					if (xfov)
					{
						xfov = THREE.Math.radToDeg(xfov);

						camera = new THREE.PerspectiveCamera(xfov, aspect_ratio, znear, zfar);
					}
				}
				else
				{
					camera = new THREE.OrthographicCamera( window.innerWidth / - 2, window.innerWidth / 2, window.innerHeight / 2, window.innerHeight / - 2, znear, zfar );
				}

				if (camera)
				{
					this.resources.setEntry(entryID, camera, description);
				}

				return true;
			}
		},

		handleLight: {
			value: function(entryID, description, userInfo) {

				var light = null;
				var type = description.type;
				if (type && description[type])
				{
					var lparams = description[type];
					var color = RgbArraytoHex(lparams.color);

					switch (type) {
						case "directional" :
							light = new THREE.DirectionalLight(color);
							light.position.set(0, 0, 1);
						break;

						case "point" :
							light = new THREE.PointLight(color);
						break;

						case "spot " :
							light = new THREE.SpotLight(color);
							light.position.set(0, 0, 1);
						break;

						case "ambient" :
							light = new THREE.AmbientLight(color);
						break;
					}
				}

				if (light)
				{
					this.resources.setEntry(entryID, light, description);
				}

				return true;
			}
		},

		addPendingMesh: {
			value: function(mesh, threeNode) {
				theLoader.pendingMeshes.push({
					mesh: mesh,
					node: threeNode
				});
			}
		},

		handleNode: {
			value: function(entryID, description, userInfo) {

				var threeNode = null;
				if (description.jointName) {
					threeNode = new THREE.Bone();
					threeNode.jointName = description.jointName;
					this.joints[description.jointName] = entryID;
				}
				else {
					threeNode = new THREE.Object3D();
				}

				threeNode.name = description.name;
				threeNode.glTFID = entryID;
				threeNode.glTF = description;

				this.resources.setEntry(entryID, threeNode, description);

				var m = description.matrix;
				if(m) {
					threeNode.matrixAutoUpdate = false;
					threeNode.applyMatrix(new THREE.Matrix4().set(
						m[0],  m[4],  m[8],  m[12],
						m[1],  m[5],  m[9],  m[13],
						m[2],  m[6],  m[10], m[14],
						m[3],  m[7],  m[11], m[15]
					));
				}
				else {
					var t = description.translation;
					var r = description.rotation;
					var s = description.scale;

					var position = t ? new THREE.Vector3(t[0], t[1], t[2]) :
						new THREE.Vector3;

					var rotation = r ? new THREE.Quaternion(r[0], r[1], r[2], r[3]) :
						new THREE.Quaternion;
					var scale = s ? new THREE.Vector3(s[0], s[1], s[2]) :
						new THREE.Vector3(1, 1, 1);

					var matrix = new THREE.Matrix4;
					matrix.compose(position, rotation, scale);
					threeNode.matrixAutoUpdate = false;
					threeNode.applyMatrix(matrix);
				}

				var self = this;

				if (description.meshes) {
					description.meshInstances = {};
					var skinEntry;
					if (description.skin) {
						skinEntry =  this.resources.getEntry(description.skin);
					}

					description.meshes.forEach( function(meshID) {
						meshEntry = this.resources.getEntry(meshID);
						theLoader.meshesRequested++;
						meshEntry.object.onComplete(function(mesh) {
							self.addPendingMesh(mesh, threeNode);
							description.meshInstances[meshID] = meshEntry.object;
							if (skinEntry) {
								mesh.skin = skinEntry;
								description.instanceSkin = skinEntry.object;
							}

							theLoader.meshesLoaded++;
							theLoader.checkComplete();
						});
					}, this);
				}

				if (description.camera) {
					var cameraEntry = this.resources.getEntry(description.camera);
					if (cameraEntry) {
						threeNode.add(cameraEntry.object);
						this.cameras.push(cameraEntry.object);
					}
				}

				if (description.extensions && description.extensions.KHR_materials_common
						&& description.extensions.KHR_materials_common.light) {
					var lightID = description.extensions.KHR_materials_common.light;
					var lightEntry = this.resources.getEntry(lightID);
					if (lightEntry) {
						threeNode.add(lightEntry.object);
						this.lights.push(lightEntry.object);
					}
				}

				return true;
			}
		},

		handleExtension: {
			value: function(entryID, description, userInfo) {

				// console.log("Extension", entryID, description);

				switch (entryID) {
					case 'KHR_materials_common' :
						var lights = description.lights;
						for (lightID in lights) {
							var light = lights[lightID];
							this.handleLight(lightID, light);
						}
						break;
				}

				return true;
			}
		},

		buildNodeHirerachy: {
			value: function(nodeEntryId, parentThreeNode) {
				var nodeEntry = this.resources.getEntry(nodeEntryId);
				var threeNode = nodeEntry.object;
				parentThreeNode.add(threeNode);

				var children = nodeEntry.description.children;
				if (children) {
					children.forEach( function(childID) {
						this.buildNodeHirerachy(childID, threeNode);
					}, this);
				}

				return threeNode;
			}
		},

		buildSkin: {
			value: function(node) {

				var glTF = node.glTF;
				var skin = glTF.instanceSkin;
				var skeletons = glTF.skeletons;
				if (skin) {
					skeletons.forEach(function(skeleton) {
						var nodeEntry = this.resources.getEntry(skeleton);
						if (nodeEntry) {

							var rootSkeleton = nodeEntry.object;
							node.add(rootSkeleton);

							var dobones = true;

							for (meshID in glTF.meshInstances) {
								var mesh = glTF.meshInstances[meshID];
								var threeMesh = null;
								mesh.primitives.forEach(function(primitive) {

									var material = primitive.material;
									var materialParams = material.params;
									if (!(material instanceof THREE.Material)) {
										material = createShaderMaterial(material);
									}

									threeMesh = new THREE.SkinnedMesh(primitive.geometry.geometry, material, false);

									var geometry = primitive.geometry.geometry;
									var j;
/*                                    if (geometry.vertices) {
										for ( j = 0; j < geometry.vertices.length; j ++ ) {
											geometry.vertices[j].applyMatrix4( skin.bindShapeMatrix );
										}
									}
									else if (geometry.attributes.position) {
										var a = geometry.attributes.position.array;
										var v = new THREE.Vector3;
										for ( j = 0; j < a.length / 3; j++ ) {
											v.set(a[j * 3], a[j * 3 + 1], a[j * 3 + 2]);
											v.applyMatrix4( skin.bindShapeMatrix );
											a[j * 3] = v.x;
											a[j * 3 + 1] = v.y;
											a[j * 3 + 2] = v.z;
										}
									}*/

									if (threeMesh && dobones) {

										material.skinning = true;

										var jointNames = skin.jointNames;
										var joints = [];
										var bones = [];
										var boneInverses = [];
										var i, len = jointNames.length;
										for (i = 0; i < len; i++) {
											var jointName = jointNames[i];
											var nodeForJoint = this.joints[jointName];
											var joint = this.resources.getEntry(nodeForJoint).object;
											if (joint) {

												joint.skin = threeMesh;
												joints.push(joint);
												bones.push(joint);

												var m = skin.inverseBindMatrices;
												var mat = new THREE.Matrix4().set(
														m[i * 16 + 0],  m[i * 16 + 4],  m[i * 16 + 8],  m[i * 16 + 12],
														m[i * 16 + 1],  m[i * 16 + 5],  m[i * 16 + 9],  m[i * 16 + 13],
														m[i * 16 + 2],  m[i * 16 + 6],  m[i * 16 + 10], m[i * 16 + 14],
														m[i * 16 + 3],  m[i * 16 + 7],  m[i * 16 + 11], m[i * 16 + 15]
													);
												boneInverses.push(mat);

											} else {
												console.log("WARNING: jointName:"+jointName+" cannot be found in skeleton:"+skeleton);
											}
										}

										threeMesh.bind( new THREE.Skeleton( bones,
											boneInverses, false ), skin.bindShapeMatrix );

										//threeMesh.bindMode = "detached";
										//threeMesh.normalizeSkinWeights();
										//threeMesh.pose();
									}

									if (threeMesh) {
										threeMesh.castShadow = true;
										node.add(threeMesh);

										if (material instanceof THREE.ShaderMaterial) {
											materialParams.joints = joints;
											var glTFShader = new THREE.glTFShader(material, materialParams, threeMesh, theLoader.rootObj);
											THREE.glTFShaders.add(glTFShader);

										}
									}

								}, this);
							}

						}


					}, this);

				}
			}
		},

		buildSkins: {
			value: function(node) {

				if (node.glTF && node.glTF.instanceSkin)
					this.buildSkin(node);

				var children = node.children;
				if (children) {
					children.forEach( function(child) {
						this.buildSkins(child);
					}, this);
				}
			}
		},

		createMeshAnimations : {
			value : function(root) {
					this.buildSkins(root);
				}
		},

		handleScene: {
			value: function(entryID, description, userInfo) {

				if (!description.nodes) {
					console.log("ERROR: invalid file required nodes property is missing from scene");
					return false;
				}

				description.nodes.forEach( function(nodeUID) {
					this.buildNodeHirerachy(nodeUID, userInfo.rootObj);
				}, this);

				if (this.delegate) {
					this.delegate.loadCompleted(userInfo.callback, userInfo.rootObj);
				}

				theLoader.loadAllAssets();

				return true;
			}
		},

		handleImage: {
			value: function(entryID, description, userInfo) {
				this.resources.setEntry(entryID, null, description);
				return true;
			}
		},

		addNodeAnimationChannel : {
			value : function(name, channel, interp) {
				if (!this.nodeAnimationChannels)
					this.nodeAnimationChannels = {};

				if (!this.nodeAnimationChannels[name]) {
					this.nodeAnimationChannels[name] = [];
				}

				this.nodeAnimationChannels[name].push(interp);
			},
		},

		createAnimations : {
			value : function() {
				for (var name in this.nodeAnimationChannels) {
					var nodeAnimationChannels = this.nodeAnimationChannels[name];
					var i, len = nodeAnimationChannels.length;
					//console.log(" animation channels for node " + name);
					//for (i = 0; i < len; i++) {
					//  console.log(nodeAnimationChannels[i]);
					//}
					var anim = new THREE.glTFAnimation(nodeAnimationChannels);
					anim.name = "animation_" + name;
					this.animations.push(anim);
				}
			}
		},

		buildAnimation: {
			value : function(animation) {

				var interps = [];
				var i, len = animation.channels.length;
				for (i = 0; i < len; i++) {

					var channel = animation.channels[i];
					var sampler = animation.samplers[channel.sampler];
					if (sampler) {

						var input = animation.parameters[sampler.input];
						if (input && input.data) {

							var output = animation.parameters[sampler.output];
							if (output && output.data) {

								var target = channel.target;
								var node = this.resources.getEntry(target.id);
								if (node) {

									var path = target.path;

									var interp = {
											keys : input.data,
											values : output.data,
											count : input.count,
											target : node.object,
											path : path,
											type : sampler.interpolation
									};

									this.addNodeAnimationChannel(target.id, channel, interp);
									interps.push(interp);
								}
							}
						}
					}
				}
			}
		},

		handleAnimation: {
			value: function(entryID, description, userInfo) {

				var self = this;
				theLoader.animationsRequested++;
				var animation = new Animation();
				animation.name = entryID;
				animation.onload = function() {
					// self.buildAnimation(animation);
					theLoader.animationsLoaded++;
					theLoader.animations.push(animation);
					theLoader.checkComplete();
				};

				animation.channels = description.channels;
				animation.samplers = description.samplers;
				this.resources.setEntry(entryID, animation, description);
				var parameters = description.parameters;
				if (!parameters) {
					//FIXME: not implemented in delegate
					console.log("MISSING_PARAMETERS for animation:"+ entryID);
					return false;
				}

				// Load parameter buffers
				var params = Object.keys(parameters);
				params.forEach( function(param) {

					// async help
					animation.totalParameters++;

				}, this);

				var params = Object.keys(parameters);
				params.forEach( function(param) {

					var parameter = parameters[param];
					var accessor = this.resources.getEntry(parameter);
					if (!accessor)
						debugger;
					accessor = accessor.object;
					var bufferView = this.resources.getEntry(accessor.bufferView);
					var paramObject = {
							bufferView : bufferView,
							byteOffset : accessor.byteOffset,
							count : accessor.count,
							componentType : accessor.componentType,
							type : accessor.type,
							id : accessor.bufferView,
							name : param
					};

					var paramContext = new AnimationParameterContext(paramObject, animation);

					var loaddata = {
						paramObject : paramObject,
						animationParameterDelegate : animationParameterDelegate,
						paramContext : paramContext
					};

					theLoader.scheduleLoad(function(data) {

						var alreadyProcessedAttribute =
							THREE.GLTFLoaderUtils.getBuffer(data.paramObject,
								data.animationParameterDelegate, data.paramContext);

						if (alreadyProcessedAttribute) {
							data.animationParameterDelegate.resourceAvailable(
								alreadyProcessedAttribute, data.paramContext);
						}

					}, loaddata);


				}, this);

				return true;
			}
		},

		handleAccessor: {
			value: function(entryID, description, userInfo) {
				// Save attribute entry
				this.resources.setEntry(entryID, description, description);
				return true;
			}
		},

		handleSkin: {
			value: function(entryID, description, userInfo) {
				// Save skin entry

				var skin = {
				};

				var m = description.bindShapeMatrix;
				skin.bindShapeMatrix = new THREE.Matrix4().set(
						m[0],  m[4],  m[8],  m[12],
						m[1],  m[5],  m[9],  m[13],
						m[2],  m[6],  m[10], m[14],
						m[3],  m[7],  m[11], m[15]
					);

				skin.jointNames = description.jointNames;
				var inverseBindMatricesDescription = this.resources.getEntry(description.inverseBindMatrices);
				inverseBindMatricesDescription = inverseBindMatricesDescription.description;
				skin.inverseBindMatricesDescription = inverseBindMatricesDescription;
				skin.inverseBindMatricesDescription.id = description.inverseBindMatrices;

				var bufferEntry = this.resources.getEntry(inverseBindMatricesDescription.bufferView);

				var paramObject = {
						bufferView : bufferEntry,
						byteOffset : inverseBindMatricesDescription.byteOffset,
						count : inverseBindMatricesDescription.count,
						componentType : inverseBindMatricesDescription.componentType,
						type : inverseBindMatricesDescription.type,
						id : inverseBindMatricesDescription.bufferView,
						name : skin.inverseBindMatricesDescription.id
				};

				var context = new InverseBindMatricesContext(paramObject, skin);

				var loaddata = {
					paramObject : paramObject,
					inverseBindMatricesDelegate : inverseBindMatricesDelegate,
					context : context
				};

				theLoader.scheduleLoad(function(data) {

					var alreadyProcessedAttribute =
						THREE.GLTFLoaderUtils.getBuffer(data.paramObject,
							data.inverseBindMatricesDelegate, data.context);

					if (alreadyProcessedAttribute) {
						data.inverseBindMatricesDelegate.resourceAvailable(
							alreadyProcessedAttribute, data.context);
					}

				}, loaddata);



				var bufferView = this.resources.getEntry(skin.inverseBindMatricesDescription.bufferView);
				skin.inverseBindMatricesDescription.bufferView =
					bufferView.object;
				this.resources.setEntry(entryID, skin, description);
				return true;
			}
		},

		handleSampler: {
			value: function(entryID, description, userInfo) {
				// Save attribute entry
				this.resources.setEntry(entryID, description, description);
				return true;
			}
		},

		handleTexture: {
			value: function(entryID, description, userInfo) {
				// Save attribute entry
				this.resources.setEntry(entryID, null, description);
				return true;
			}
		},

		handleError: {
			value: function(msg) {

				throw new Error(msg);
				return true;
			}
		},

		_delegate: {
			value: new LoadDelegate,
			writable: true
		},

		delegate: {
			enumerable: true,
			get: function() {
				return this._delegate;
			},
			set: function(value) {
				this._delegate = value;
			}
		}
	});


	// Loader

	var Context = function(rootObj, callback) {
		this.rootObj = rootObj;
		this.callback = callback;
	};

	var rootObj = new THREE.Object3D();

	var self = this;

	var loader = Object.create(ThreeGLTFLoader);
	loader.initWithPath(url);
	loader.load(new Context(rootObj,
						function(obj) {
						}),
				null);

	this.loader = loader;
	this.callback = callback;
	this.rootObj = rootObj;
	return rootObj;
}


THREE.glTFLoader.prototype.scheduleLoad = function(loadFn, data) {

	this.loadRequests.push({fn: loadFn, data:data});
}

THREE.glTFLoader.prototype.loadAllAssets = function() {

	for (var i = 0, len = this.loadRequests.length; i < len; i++) {
		var request = this.loadRequests[i];
		request.fn(request.data);
	}
}

THREE.glTFLoader.prototype.callLoadedCallback = function() {
	var result = {
			scene : this.rootObj,
			cameras : this.loader.cameras,
			animations : this.loader.animations,
			shaders : this.loader.shaders,
	};

	this.callback(result);
}

THREE.glTFLoader.prototype.checkComplete = function() {
	if (this.meshesLoaded == this.meshesRequested
			&& this.shadersLoaded == this.shadersRequested
			&& this.animationsLoaded == this.animationsRequested)
	{
		for (var i = 0; i < this.pendingMeshes.length; i++) {
			var pending = this.pendingMeshes[i];
			pending.mesh.attachToNode(pending.node);
		}

		for (var i = 0; i < this.animationsLoaded; i++) {
			var animation = this.animations[i];
			this.loader.buildAnimation(animation);
		}

		this.loader.createAnimations();
		this.loader.createMeshAnimations(this.rootObj);
		THREE.glTFShaders.bindShaderParameters(this.rootObj);

		this.callLoadedCallback();
	}
}
/**
 * @author Tony Parisi / http://www.tonyparisi.com/
 */

THREE.GLTFLoaderUtils = Object.create(Object, {

    // errors
    MISSING_DESCRIPTION: { value: "MISSING_DESCRIPTION" },
    INVALID_PATH: { value: "INVALID_PATH" },
    INVALID_TYPE: { value: "INVALID_TYPE" },
    XMLHTTPREQUEST_STATUS_ERROR: { value: "XMLHTTPREQUEST_STATUS_ERROR" },
    NOT_FOUND: { value: "NOT_FOUND" },
    // misc constants
    ARRAY_BUFFER: { value: "ArrayBuffer" },

    _streams : { value:{}, writable: true },

    _streamsStatus: { value: {}, writable: true },
    
    _resources: { value: {}, writable: true },

    _resourcesStatus: { value: {}, writable: true },

    // initialization
    init: {
        value: function() {
	        this._streams = {};
	        this._streamsStatus = {};
            this._resources = {};
            this._resourcesStatus = {};
        }
    },

    //manage entries
    _containsResource: {
        enumerable: false,
        value: function(resourceID) {
            return this._resources[resourceID] ? true : false;
        }
    },

    _storeResource: {
        enumerable: false,
        value: function(resourceID, resource) {
            if (!resourceID) {
                console.log("ERROR: entry does not contain id, cannot store");
                return;
            }

            if (this._containsResource[resourceID]) {
                console.log("WARNING: resource:"+resourceID+" is already stored, overriding");
            }

           this._resources[resourceID] = resource;
        }
    },

    _getResource: {
        enumerable: false,
        value: function(resourceID) {
            return this._resources[resourceID];
        }
    },

    _loadStream: {
        value: function(path, type, delegate) {



            var dataUriRegex = /^data:(.*?)(;base64)?,(.*)$/;

            function decodeDataUriText(isBase64, data) {
                var result = decodeURIComponent(data);
                if (isBase64) {
                    return atob(result);
                }
                return result;
            }

            function decodeDataUriArrayBuffer(isBase64, data) {
                var byteString = decodeDataUriText(isBase64, data);
                var buffer = new ArrayBuffer(byteString.length);
                var view = new Uint8Array(buffer);
                for (var i = 0; i < byteString.length; i++) {
                    view[i] = byteString.charCodeAt(i);
                }
                return buffer;
            }

            function decodeDataUri(dataUriRegexResult, responseType) {
                responseType = typeof responseType !== 'undefined' ? responseType : '';
                var mimeType = dataUriRegexResult[1];
                var isBase64 = !!dataUriRegexResult[2];
                var data = dataUriRegexResult[3];

                switch (responseType) {
                case '':
                case 'text':
                    return decodeDataUriText(isBase64, data);
                case 'ArrayBuffer':
                    return decodeDataUriArrayBuffer(isBase64, data);
                case 'blob':
                    var buffer = decodeDataUriArrayBuffer(isBase64, data);
                    return new Blob([buffer], {
                        type : mimeType
                    });
                case 'document':
                    var parser = new DOMParser();
                    return parser.parseFromString(decodeDataUriText(isBase64, data), mimeType);
                case 'json':
                    return JSON.parse(decodeDataUriText(isBase64, data));
                default:
                    throw 'Unhandled responseType: ' + responseType;
                }
            }

            var dataUriRegexResult = dataUriRegex.exec(path);
            if (dataUriRegexResult !== null) {
                delegate.streamAvailable(path, decodeDataUri(dataUriRegexResult, type));
                return;
            }

            var self = this;

            if (!type) {
                delegate.handleError(THREE.GLTFLoaderUtils.INVALID_TYPE, null);
                return;
            }

            if (!path) {
                delegate.handleError(THREE.GLTFLoaderUtils.INVALID_PATH);
                return;
            }

            var xhr = new XMLHttpRequest();
            xhr.open('GET', path, true);
            xhr.responseType = (type === this.ARRAY_BUFFER) ? "arraybuffer" : "text";

            //if this is not specified, 1 "big blob" scenes fails to load.
            xhr.setRequestHeader("If-Modified-Since", "Sat, 01 Jan 1970 00:00:00 GMT");
            xhr.onload = function(e) {
                if ((xhr.status == 200) || (xhr.status == 206)) {

                    delegate.streamAvailable(path, xhr.response);

                } else {
                    delegate.handleError(THREE.GLTFLoaderUtils.XMLHTTPREQUEST_STATUS_ERROR, this.status);
                }
            };
            xhr.send(null);
        }
    },

    send: { value: 0, writable: true },
    requested: { value: 0, writable: true },

    _handleRequest: {
        value: function(request) {
            var resourceStatus = this._resourcesStatus[request.id];
            if (resourceStatus)
            {
            	this._resourcesStatus[request.id]++;
            }
            else
            {
            	this._resourcesStatus[request.id] = 1;
            }
            
            var streamStatus = this._streamsStatus[request.uri];
            if (streamStatus && streamStatus.status === "loading" )
            {
            	streamStatus.requests.push(request);
                return;
            }
            
            this._streamsStatus[request.uri] = { status : "loading", requests : [request] };
    		
            var self = this;
            var processResourceDelegate = {};

            processResourceDelegate.streamAvailable = function(path, res_) {
            	var streamStatus = self._streamsStatus[path];
            	var requests = streamStatus.requests;
                requests.forEach( function(req_) {
                    var subArray = res_.slice(req_.range[0], req_.range[1]);
                    var convertedResource = req_.delegate.convert(subArray, req_.ctx);
                    self._storeResource(req_.id, convertedResource);
                    req_.delegate.resourceAvailable(convertedResource, req_.ctx);
                    --self._resourcesStatus[req_.id];

                }, this);
            	
                delete self._streamsStatus[path];

            };

            processResourceDelegate.handleError = function(errorCode, info) {
                request.delegate.handleError(errorCode, info);
            }

            this._loadStream(request.uri, request.type, processResourceDelegate);
        }
    },


    _elementSizeForGLType: {
        value: function(componentType, type) {
    	
    		var nElements = 0;
    		switch(type) {    		
	            case "SCALAR" :
	                nElements = 1;
	                break;
	            case "VEC2" :
	                nElements = 2;
	                break;
	            case "VEC3" :
	                nElements = 3;
	                break;
	            case "VEC4" :
	                nElements = 4;
	                break;
	            case "MAT2" :
	                nElements = 4;
	                break;
	            case "MAT3" :
	                nElements = 9;
	                break;
	            case "MAT4" :
	                nElements = 16;
	                break;
	            default :
	            	debugger;
	            	break;
    		}
    		
            switch (componentType) {
                case WebGLRenderingContext.FLOAT :
                    return Float32Array.BYTES_PER_ELEMENT * nElements;
                case WebGLRenderingContext.UNSIGNED_BYTE :
                    return Uint8Array.BYTES_PER_ELEMENT * nElements;
                case WebGLRenderingContext.UNSIGNED_SHORT :
                    return Uint16Array.BYTES_PER_ELEMENT * nElements;
                default :
                	debugger;
                    return null;
            }
        }
    },

    _handleWrappedBufferViewResourceLoading: {
        value: function(wrappedBufferView, delegate, ctx) {
            var bufferView = wrappedBufferView.bufferView;
            var buffer = bufferView.buffer;
            var byteOffset = wrappedBufferView.byteOffset + bufferView.description.byteOffset;
            var range = [byteOffset , (this._elementSizeForGLType(wrappedBufferView.componentType, wrappedBufferView.type) * wrappedBufferView.count) + byteOffset];

            this._handleRequest({   "id" : wrappedBufferView.id,
                                    "range" : range,
                                    "type" : buffer.description.type,
                                    "uri" : buffer.description.uri,
                                    "delegate" : delegate,
                                    "ctx" : ctx }, null);
        }
    },
    
    getBuffer: {
    	
            value: function(wrappedBufferView, delegate, ctx) {

            var savedBuffer = this._getResource(wrappedBufferView.id);
            if (false) { // savedBuffer) {
                return savedBuffer;
            } else {
                this._handleWrappedBufferViewResourceLoading(wrappedBufferView, delegate, ctx);
            }

            return null;
        }
    },

    getFile: {
    	
        value: function(request, delegate, ctx) {

    		request.delegate = delegate;
    		request.ctx = ctx;

            this._handleRequest({   "id" : request.id,
                "uri" : request.uri,
                "range" : [0],
                "type" : "text",
                "delegate" : delegate,
                "ctx" : ctx }, null);
    	
            return null;
	    }
	},    
});
/**
 * @author Tony Parisi / http://www.tonyparisi.com/
 */

THREE.glTFAnimator = ( function () {

	var animators = [];

	return	{
		add : function(animator)
		{
			animators.push(animator);
		},

		remove: function(animator)
		{

			var i = animators.indexOf(animator);

			if ( i !== -1 ) {
				animators.splice( i, 1 );
			}
		},

		update : function()
		{
			for (i = 0; i < animators.length; i++)
			{
				animators[i].update();
			}
		},
	};
})();

// Construction/initialization
THREE.glTFAnimation = function(interps)
{
	this.running = false;
	this.loop = false;
	this.duration = 0;
	this.startTime = 0;
	this.interps = [];
	
	if (interps)
	{
		this.createInterpolators(interps);
	}
}

THREE.glTFAnimation.prototype.createInterpolators = function(interps)
{
	var i, len = interps.length;
	for (i = 0; i < len; i++)
	{
		var interp = new THREE.glTFInterpolator(interps[i]);
		this.interps.push(interp);
		this.duration = Math.max(this.duration, interp.duration);
	}
}

// Start/stop
THREE.glTFAnimation.prototype.play = function()
{
	if (this.running)
		return;
	
	this.startTime = Date.now();
	this.running = true;
	THREE.glTFAnimator.add(this);
}

THREE.glTFAnimation.prototype.stop = function()
{
	this.running = false;
	THREE.glTFAnimator.remove(this);
}

// Update - drive key frame evaluation
THREE.glTFAnimation.prototype.update = function()
{
	if (!this.running)
		return;
	
	var now = Date.now();
	var deltat = (now - this.startTime) / 1000;
	var t = deltat % this.duration;
	var nCycles = Math.floor(deltat / this.duration);
	
	if (nCycles >= 1 && !this.loop)
	{
		this.running = false;
		var i, len = this.interps.length;
		for (i = 0; i < len; i++)
		{
			this.interps[i].interp(this.duration);
		}
		this.stop();
		return;
	}
	else
	{
		var i, len = this.interps.length;
		for (i = 0; i < len; i++)
		{
			this.interps[i].interp(t);
		}
	}
}

//Interpolator class
//Construction/initialization
THREE.glTFInterpolator = function(param) 
{	    		
	this.keys = param.keys;
	this.values = param.values;
	this.count = param.count;
	this.type = param.type;
	this.path = param.path;
	this.isRot = false;
	
	var node = param.target;
	node.updateMatrix();
	node.matrixAutoUpdate = true;
	this.targetNode = node;
	
	switch (param.path) {
		case "translation" :
			this.target = node.position;
			this.originalValue = node.position.clone();
			break;
		case "rotation" :
			this.target = node.quaternion;
			this.originalValue = node.quaternion.clone();
			this.isRot = true;
			break;
		case "scale" :
			this.target = node.scale;
			this.originalValue = node.scale.clone();
			break;
	}
	
	this.duration = this.keys[this.count - 1];
	
	this.vec1 = new THREE.Vector3;
	this.vec2 = new THREE.Vector3;
	this.vec3 = new THREE.Vector3;
	this.quat1 = new THREE.Quaternion;
	this.quat2 = new THREE.Quaternion;
	this.quat3 = new THREE.Quaternion;
}

//Interpolation and tweening methods
THREE.glTFInterpolator.prototype.interp = function(t)
{
	var i, j;
	if (t == this.keys[0])
	{
		if (this.isRot) {
			this.quat3.set(this.values[0], this.values[1], this.values[2], this.values[3]);
		}
		else {
			this.vec3.set(this.values[0], this.values[1], this.values[2]);
		}
	}
	else if (t < this.keys[0])
	{
		if (this.isRot) {
			this.quat1.set(this.originalValue.x,
					this.originalValue.y,
					this.originalValue.z,
					this.originalValue.w);
			this.quat2.set(this.values[0],
					this.values[1],
					this.values[2],
					this.values[3]);
			THREE.Quaternion.slerp(this.quat1, this.quat2, this.quat3, t / this.keys[0]);
		}
		else {
			this.vec3.set(this.originalValue.x,
					this.originalValue.y,
					this.originalValue.z);
			this.vec2.set(this.values[0],
					this.values[1],
					this.values[2]);

			this.vec3.lerp(this.vec2, t / this.keys[0]);
		}
	}
	else if (t >= this.keys[this.count - 1])
	{
		if (this.isRot) {
			this.quat3.set(this.values[(this.count - 1) * 4], 
					this.values[(this.count - 1) * 4 + 1],
					this.values[(this.count - 1) * 4 + 2],
					this.values[(this.count - 1) * 4 + 3]);
		}
		else {
			this.vec3.set(this.values[(this.count - 1) * 3], 
					this.values[(this.count - 1) * 3 + 1],
					this.values[(this.count - 1) * 3 + 2]);
		}
	}
	else
	{
		for (i = 0; i < this.count - 1; i++)
		{
			var key1 = this.keys[i];
			var key2 = this.keys[i + 1];
	
			if (t >= key1 && t <= key2)
			{
				if (this.isRot) {
					this.quat1.set(this.values[i * 4],
							this.values[i * 4 + 1],
							this.values[i * 4 + 2],
							this.values[i * 4 + 3]);
					this.quat2.set(this.values[(i + 1) * 4],
							this.values[(i + 1) * 4 + 1],
							this.values[(i + 1) * 4 + 2],
							this.values[(i + 1) * 4 + 3]);
					THREE.Quaternion.slerp(this.quat1, this.quat2, this.quat3, (t - key1) / (key2 - key1));
				}
				else {
					this.vec3.set(this.values[i * 3],
							this.values[i * 3 + 1],
							this.values[i * 3 + 2]);
					this.vec2.set(this.values[(i + 1) * 3],
							this.values[(i + 1) * 3 + 1],
							this.values[(i + 1) * 3 + 2]);
	
					this.vec3.lerp(this.vec2, (t - key1) / (key2 - key1));
				}
			}
		}
	}
	
	if (this.target)
	{
		this.copyValue(this.target);
	}
}

THREE.glTFInterpolator.prototype.copyValue = function(target) {
	
	if (this.isRot) {
		target.copy(this.quat3);
	}
	else {
		target.copy(this.vec3);
	}		
}
/**
 * @author Tony Parisi / http://www.tonyparisi.com/
 */

THREE.glTFShaders = ( function () {

	var shaders = [];

	return	{
		add : function(shader) {
			shaders.push(shader);
		},

		remove: function(shader) {

			var i = shaders.indexOf(shader);

			if ( i !== -1 ) {
				shaders.splice( i, 1 );
			}
		},

		removeAll: function(shader) {

			// probably want to clean up the shaders, too, but not for now
			shaders = [];
		},

		bindShaderParameters: function(scene) {
			for (i = 0; i < shaders.length; i++)
			{
				shaders[i].bindParameters(scene);
			}
		},

		update : function(scene, camera) {
			for (i = 0; i < shaders.length; i++)
			{
				shaders[i].update(scene, camera);
			}
		},
	};
})();

// Construction/initialization
THREE.glTFShader = function(material, params, object, scene) {
	this.material = material;
	this.parameters = params.technique.parameters;
	this.uniforms = params.technique.uniforms;
	this.joints = params.joints;
	this.object = object;
	this.semantics = {};
	this.m4 = new THREE.Matrix4;
}


// bindParameters - connect the uniform values to their source parameters
THREE.glTFShader.prototype.bindParameters = function(scene) {

	function findObject(o, p) { 
		if (o.glTFID == param.node) {
			p.sourceObject = o;
		}
	}

	for (var uniform in this.uniforms) {
		var pname = this.uniforms[uniform];
		var param = this.parameters[pname];
		if (param.semantic) {

			var p = { 
				semantic : param.semantic,
				uniform: this.material.uniforms[uniform] 
			};

			if (param.node) {
				scene.traverse(function(o) { findObject(o, p)});
			}
			else {
				p.sourceObject = this.object;
			}			

			this.semantics[pname] = p;

		}
	}

}

// Update - update all the uniform values
THREE.glTFShader.prototype.update = function(scene, camera) {

	// update scene graph

	scene.updateMatrixWorld();

	// update camera matrices and frustum
	camera.updateMatrixWorld();
	camera.matrixWorldInverse.getInverse( camera.matrixWorld );

	for (var sname in this.semantics) {
		var semantic = this.semantics[sname];
        if (semantic) {
	        switch (semantic.semantic) {
	            case "MODELVIEW" :
	            	var m4 = semantic.uniform.value;
	            	m4.multiplyMatrices(camera.matrixWorldInverse, 
	            		semantic.sourceObject.matrixWorld);
	                break;

	            case "MODELVIEWINVERSETRANSPOSE" :
	            	var m3 = semantic.uniform.value;
	            	this.m4.multiplyMatrices(camera.matrixWorldInverse, 
	            		semantic.sourceObject.matrixWorld);
					m3.getNormalMatrix(this.m4);
	                break;

	            case "PROJECTION" :
	            	var m4 = semantic.uniform.value;
	            	m4.copy(camera.projectionMatrix);            		
	                break;

	            case "JOINTMATRIX" :
	            
	            	var m4v = semantic.uniform.value;
					for (var mi = 0; mi < m4v.length; mi++) {
						// So it goes like this:
						// SkinnedMesh world matrix is already baked into MODELVIEW;
						// ransform joints to local space,
						// then transform using joint's inverse
						m4v[mi].getInverse(semantic.sourceObject.matrixWorld).
							multiply(this.joints[mi].matrixWorld).
							multiply(this.object.skeleton.boneInverses[mi]);
					}
	            
	                //console.log("Joint:", semantic)
	                break;

	            default :
	                throw new Error("Unhandled shader semantic" + semantic);
	                break;
	        }
        }
	}
}
