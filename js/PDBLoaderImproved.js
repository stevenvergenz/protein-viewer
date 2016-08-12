'use strict';

// web workers need this imported especially
if(self.importScripts)
	self.importScripts('../lib/three.r74.min.js');

// web workers don't have a window object
try {
	window.THREE = window.THREE || {};
}
catch(e){
	var window = {
		THREE: self.THREE,
		console: {
			log: function(){
				self.postMessage({type: 'log', message: Array.prototype.slice.call(arguments).join(' ')});
			}
		}
	};
}


(function(THREE)
{
	// atomic colors
	var CPK = {"h":16777215,"he":14286847,"li":13402367,"be":12779264,"b":16758197,"c":9474192,"n":3166456,"o":16715021,"f":9494608,"ne":11789301,"na":11230450,"mg":9109248,"al":12560038,"si":15780000,"p":16744448,"s":16777008,"cl":2093087,"ar":8442339,"k":9388244,"ca":4062976,"sc":15132390,"ti":12567239,"v":10921643,"cr":9083335,"mn":10255047,"fe":14706227,"co":15765664,"ni":5296208,"cu":13140019,"zn":8224944,"ga":12750735,"ge":6721423,"as":12419299,"se":16752896,"br":10889513,"kr":6076625,"rb":7351984,"sr":65280,"y":9764863,"zr":9756896,"nb":7586505,"mo":5551541,"tc":3907230,"ru":2396047,"rh":687500,"pd":27013,"ag":12632256,"cd":16767375,"in":10909043,"sn":6717568,"sb":10380213,"te":13924864,"i":9699476,"xe":4366000,"cs":5707663,"ba":51456,"la":7394559,"ce":16777159,"pr":14286791,"nd":13107143,"pm":10747847,"sm":9437127,"eu":6422471,"gd":4587463,"tb":3211207,"dy":2097095,"ho":65436,"er":58997,"tm":54354,"yb":48952,"lu":43812,"hf":5096191,"ta":5089023,"w":2200790,"re":2522539,"os":2516630,"ir":1528967,"pt":13684960,"au":16765219,"hg":12105936,"tl":10900557,"pb":5724513,"bi":10375093,"po":11230208,"at":7688005,"rn":4358806,"fr":4325478,"ra":32000,"ac":7384058,"th":47871,"pa":41471,"u":36863,"np":33023,"pu":27647,"am":5528818,"cm":7888099,"bk":9064419,"cf":10565332,"es":11739092,"fm":11739066,"md":11734438,"no":12389767,"lr":13041766,"rf":13369433,"db":13697103,"sg":14221381,"bh":14680120,"hs":15073326,"mt":15400998,"ds":15400998,"rg":15400998,"cn":15400998,"uut":15400998,"uuq":15400998,"uup":15400998,"uuh":15400998,"uus":15400998,"uuo":15400998};

	var covalentRadius = {h:31, he:28, li:128, be:96, b:84, c:73, n:71, o:66, f:57, na:166, mg:141, al:121, si:111, p:107, s:105, cl:102, k:203, ca:176, sc:170, ti:160, v:153, cr:139, mn:139, fe:132, co:126, ni:124, cu:132, zn:122, ga:122, ge:120, as:119, se:120, br:120};

	function throttle(callback, timeout)
	{
		timeout = timeout || 20;
		var wait = false;
		return function(){
			if(!wait){
				callback.apply(undefined, arguments);
				wait = true;
				setTimeout(function(){
					wait = false;
				}, timeout);
			}
		};
	}

	THREE.PDBLoader = function ( manager ) {
		this.manager = ( manager !== undefined ) ? manager : THREE.DefaultLoadingManager;
	};

	THREE.PDBLoader.prototype = {

		constructor: THREE.PDBLoader,

		load: function ( url, onLoad, onProgress, onError ) {

			var scope = this;

			if(window.Worker)
			{
				window.console.log('spinning up worker');
				var worker = new Worker('js/PDBLoaderImproved.js');
				worker.postMessage('../'+url);
				worker.onmessage = function(msg)
				{
					var payload = msg.data;

					if(payload.type === 'log')
						window.console.log(payload.message);
					else if(payload.type === 'model')
					{
						var model = deserialize(payload.data);
						onLoad(model, model.userData);
						worker.terminate();
					}
				};
			}
			else
			{
				var loader = new THREE.XHRLoader( scope.manager );
				loader.load( url, function (text)
				{
					var json = scope.parsePDB(text);
					var model = scope.createStickBallModels(json, null);
					onLoad(model, json);
				}, undefined, onError );
			}
		},


		parsePDB: function(text)
		{
			function parseChainInfo(line)
			{
				var chainRE = /^DBREF (.{4}) (.) (.{4})(.) (.{4})(.)/;
				var match = chainRE.exec(line);
				if(match){
					return {
						proteinID: match[1].trim(),
						chainID: match[2].trim(),
						seqBegin: parseInt(match[3]),
						seqEnd: parseInt(match[5])
					}
				}
				else return null;
			}

			function parseModel(lines)
			{
				var modelRE = /^MODEL     (.{4})/;
				var endmdlRE = /^ENDMDL/;

				// check for start and end tags
				var match = modelRE.exec(lines[0]);
				if(match)
					var modelNum = parseInt(match[1]);

				// load atom list
				var atoms = [];
				for(var i=1; i<lines.length-1; i++)
				{
					var atom = parseAtom(lines[i]);
					if(atom) atoms.push(atom);
				}

				return {
					serial: modelNum,
					atoms: atoms
				};
			}

			function parseAtom(line)
			{
				var atomRE = /^(?:HETATM|ATOM  )(.{5}) (.{4})(.)(.{3}) (.)(.{4})(.)   (.{8})(.{8})(.{8})(.{6})(.{6})          (.{2})(.{2})$/;

				var match = atomRE.exec(line);
				if(match)
				{
					var fields = match.slice(1).map(function(s){ return s.trim(); });

					return {
						type: match[0].slice(0,6).trim(),
						serial: parseInt(fields[0]),
						name: fields[1],
						altLoc: fields[2],
						resName: fields[3],
						chainID: fields[4],
						resSeq: fields[5],
						iCode: fields[6],
						x: parseFloat(fields[7]),
						y: parseFloat(fields[8]),
						z: parseFloat(fields[9]),
						occupancy: parseFloat(fields[10]),
						tempFactor: parseFloat(fields[11]),
						element: fields[12],
						charge: fields[13]
					};
				}

				else return null;
			}

			function parseBond(line)
			{
				var conectRE = /^CONECT (.{5})(.{5})(.{5})(.{5})(.{5})/;
				var match = conectRE.exec(line);
				if(match)
				{
					return {
						atomIndex: parseInt(match[1]),
						bond1: parseInt(match[2]),
						bond2: parseInt(match[3]),
						bond3: parseInt(match[4]),
						bond4: parseInt(match[5])
					};
				}
				else
					return null;
			}

			var lines = text.split('\r\n');
			if(lines.length === 1)
				lines = text.split('\n');

			var cursor = 0;
			var data = {};

			// check for MODELs
			var start, end;
			for(var i=cursor; i<lines.length; i++){
				if(start !== undefined && /^ENDMDL/.test(lines[i])){
					end = i;
					break;
				}
				else if(/^MODEL/.test(lines[i]))
					start = i;
			}

			if( start !== undefined && end !== undefined ){
				data.model = parseModel( lines.slice(cursor+start, cursor+end+1) );
				cursor += end+1;
			}
			// load all atoms into one model if no MODEL/ENDMDL tags
			else
			{
				data.model = parseModel( lines );
			}

			// load manual connections
			var bonds = lines
				.slice(cursor)
				.map(function(e){ return parseBond(e); })
				.filter(function(e){ return !!e; });

			data.bonds = bonds;

			return data;
		},

		createStickBallModels: function(json, options)
		{
			// define default options
			options = options || {};
			options.mergeLikeAtoms = options.mergeLikeAtoms !== undefined ? options.mergeLikeAtoms : true;
			options.meshVertexLimit = options.meshVertexLimit || 65000;
			options.bondFudgeFactor = options.bondFudgeFactor || 0.16;
			options.verbose = options.verbose !== undefined ? options.verbose : true;
			options.atomCutoff = options.atomCutoff || 14000;

			var molecule = json.model;

			if(molecule.atoms.length > options.atomCutoff){
				console.error(molecule.atoms.length+' atoms is too large to render, aborting.');
				return;
			}

			var outputMeshes = [];
			var atomMap = {};
			var bondMap = {};

			var max = new THREE.Vector3(), min = new THREE.Vector3();

			var stick = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 3, 1, true), new THREE.MeshBasicMaterial({color: 0xffffff}));
			stick.geometry.rotateX(Math.PI/2);
			var ballGeometry = new THREE.BoxGeometry(0.2,0.2,0.2);
			
			var bonds = new THREE.Mesh(new THREE.Geometry(), stick.material);
			bonds.name = 'bonds';
			if(options.mergeLikeAtoms)
				outputMeshes.push(bonds);


			// loop over all atoms in the molecule
			molecule.atoms.forEach(function(atom, i)
			{
				/*
				* Generate atom balls
				*/
				var e = atom.element.toLowerCase();

				// index materials and/or meshes
				if(!atomMap[e])
				{
					atomMap[e] = new THREE.Mesh(new THREE.Geometry(), new THREE.MeshBasicMaterial({color: CPK[e]}));
					atomMap[e].name = e+'_group';
					if(options.mergeLikeAtoms)
						outputMeshes.push(atomMap[e]);
				}

				var mesh = new THREE.Mesh(ballGeometry, atomMap[e].material);
				mesh.name = 'atom_'+atom.serial;

				// position in angstroms
				mesh.position.set(atom.x, atom.y, atom.z);
				mesh.updateMatrix();

				// update bounds of molecule for later centering
				max.max(mesh.position);
				min.min(mesh.position);

				// add to molecule
				if(options.mergeLikeAtoms)
				{
					if(atomMap[e].geometry.faces.length*3 + mesh.geometry.faces.length*3 > options.meshVertexLimit)
					{
						atomMap[e] = new THREE.Mesh(new THREE.Geometry(), atomMap[e].material);
						outputMeshes.push(atomMap[e]);
					}

					atomMap[e].geometry.mergeMesh(mesh);
				}
				else
					outputMeshes.push(mesh);


				/*
				* Generate bond sticks
				*/

				// look ahead for any atoms that are nearby
				for(var j=i+1; j<molecule.atoms.length; j++)
				{
					// don't bond to other chains
					var neighbor = molecule.atoms[j];
					if(neighbor.chainId !== atom.chainId
						|| Math.abs(neighbor.seqRes - atom.seqRes) > 1
					)
						continue;

					var v2 = new THREE.Vector3(neighbor.x, neighbor.y, neighbor.z);

					// get distance between atoms, compared to covalent radii
					var dist = mesh.position.distanceTo(v2);
					var covalentDist = 0.01*covalentRadius[e] + 0.01*covalentRadius[neighbor.element.toLowerCase()];

					// they are bonded
					if( Math.abs(dist - covalentDist) <= options.bondFudgeFactor*covalentDist )
					{
						// add to bond map
						if(bondMap[i]) bondMap[i].push(j);
						else bondMap[i] = [j];

						// generate stick
						var start = mesh.position, end = v2;
						stick.position.copy( start );
						stick.position.lerp( end, 0.5 );
						stick.scale.setZ( start.distanceTo( end ) );
						stick.lookAt( end );

						if(options.mergeLikeAtoms)
						{
							if(bonds.geometry.faces.length*3 + stick.geometry.faces.length*3 > options.meshVertexLimit)
							{
								bonds = new THREE.Mesh(new THREE.Geometry(), stick.material);
								outputMeshes.push(bonds);
							}

							bonds.geometry.mergeMesh(stick);
						}
						else
							outputMeshes.push( stick.clone() );
					}
				}
			});

			// generate manual bonds
			json.bonds.forEach(function(bond)
			{
				for(var i=1; bond['bond'+i] && i<=4; i++)
				{
					// make sure a < b
					var a = Math.min(bond.atomIndex, bond['bond'+i]) - 1,
						b = Math.max(bond.atomIndex, bond['bond'+i]) - 1;

					var aa = molecule.atoms[a], ab = molecule.atoms[b];
					var va = new THREE.Vector3(aa.x, aa.y, aa.z);
					var vb = new THREE.Vector3(ab.x, ab.y, ab.z);

					if( !bondMap[a] || bondMap[a].indexOf(b) === -1 )
					{
						// add to bond map
						bondMap[a] = bondMap[a] || [];
						bondMap[a].push(b);

						// generate stick
						stick.position.copy( va );
						stick.position.lerp( vb, 0.5 );
						stick.scale.setZ( va.distanceTo( vb ) );
						stick.lookAt( vb );

						if(options.mergeLikeAtoms)
						{
							if(bonds.geometry.faces.length*3 + stick.geometry.faces.length*3 > options.meshVertexLimit)
							{
								bonds = new THREE.Mesh(new THREE.Geometry(), stick.material);
								outputMeshes.push(bonds);
							}

							bonds.geometry.mergeMesh(stick);
						}
						else
							outputMeshes.push( stick.clone() );
					}
				}
			});

			// calculate geometry offset
			var offset = max.add(min).multiplyScalar(0.5).negate();
			window.console.log(offset.toArray());
			outputMeshes.forEach(function(m){
				m.geometry.translate(offset.x, offset.y, offset.z);
			});

			// output debug and validation information
			if(options.verbose)
			{
				// check for empty geometry
				outputMeshes.forEach(function(o){
					if(o.geometry && o.geometry.faces.length === 0){
						window.console.log('No faces in mesh', o.name);
					}
				});

				// check for unbonded or overbonded atoms
				var bondCount = {};
				molecule.atoms.forEach(function(a,i){
					bondCount[i] = 0;
				});

				for(var i in bondMap)
				{
					bondCount[i] += bondMap[i].length;
					for(var j=0; j<bondMap[i].length; j++){
						bondCount[ bondMap[i][j] ] += 1;
					}
				}

				window.console.log('Most bonded atom has:',
					Object.keys(bondCount).reduce(function(sum,ai){
						return Math.max(sum, bondCount[ai]);
					}, 0)
				);

				for(var i in bondCount)
				{
					if(bondCount[i] === 0 && molecule.atoms[i].type !== 'HETATM'){
						window.console.log(molecule.atoms[i], 'is unbonded!');
					}
				}
			}

			// convert finished model into buffer geometry
			// may as well, we're not changing it
			var model = new THREE.Object3D();
			model.userData = json;

			outputMeshes.forEach(function(mesh1)
			{
				model.add(
					new THREE.Mesh(
						new THREE.BufferGeometry().fromGeometry(mesh1.geometry),
						mesh1.material
					)
				);
			});

			return model;
		}
	};

	/********************************************
		Web worker stuff
	********************************************/

	function serialize(obj3d)
	{
		var library = {
			geometry: {},
			materials: {},
			meshes: {},
			objects: {}
		};

		// compute the total size of the geometry data
		var totalBufferLength = 0;
		obj3d.traverse(function(o){
			if(o instanceof THREE.Mesh){
				var geometry = o.geometry;
				for(var i in geometry.attributes){
					totalBufferLength += geometry.attributes[i].array.buffer.byteLength;
				}
			}
		});
		window.console.log(totalBufferLength+' bytes of buffer data');

		// create the one buffer to rule them all
		var buffer = new ArrayBuffer(totalBufferLength);
		library.buffer = buffer;
		var offset = 0;

		obj3d.traverse(function(o)
		{
			var obj = {
				transform: o.matrix.toArray(),
				children: o.children.map(function(o2){ return o2.id; }),
				parent: o.parent ? o.parent.id : null,
				mesh: null,
				name: o.name,
				userData: o.userData
			};

			// add object to library
			library.objects[o.id] = obj;

			// serialize all the mesh data
			if(o instanceof THREE.Mesh)
			{
				var mesh = {
					geometry: o.geometry.id,
					material: o.material.id
				};

				// add mesh references
				library.meshes[o.id] = mesh;
				obj.mesh = o.id;

				// serialize material
				if(!library.materials[o.material.id])
				{
					library.materials[o.material.id] = {
						color: o.material.color.getHex()
					};
				}

				// serialize geometry
				if(!library.geometry[o.geometry.id])
				{
					var geo = {};
					library.geometry[o.geometry.id] = geo;

					Object.keys(o.geometry.attributes).forEach(function(key)
					{
						var attr = o.geometry.attributes[key];
						geo[key] = {
							stride: attr.itemSize,
							offset: offset,
							length: attr.array.length
						};

						// detect type of buffer
						var type;
						if( attr.array instanceof Float32Array ){
							geo[key].type = 'Float32';
							type = Float32Array;
						}
						else if( attr.array instanceof Float64Array ){
							geo[key].type = 'Float64';
							type = Float64Array;
						}
						else if( attr.array instanceof Uint8Array ){
							geo[key].type = 'Uint8';
							type = Uint8Array;
						}
						else if( attr.array instanceof Uint8ClampedArray ){
							geo[key].type = 'Uint8Clamped';
							type = Uint8ClampedArray;
						}
						else if( attr.array instanceof Int8Array ){
							geo[key].type = 'Int8';
							type = Int8Array;
						}
						else if( attr.array instanceof Uint16Array ){
							geo[key].type = 'Uint16';
							type = Uint16Array;
						}
						else if( attr.array instanceof Int16Array ){
							geo[key].type = 'Int16';
							type = Int16Array;
						}
						else if( attr.array instanceof Uint32Array ){
							geo[key].type = 'Uint32';
							type = Uint32Array;
						}
						else if( attr.array instanceof Int32Array ){
							geo[key].type = 'Int32';
							type = Int32Array;
						}
						
						// copy buffer to grand buffer
						var dest = new type(buffer, offset);
						dest.set(attr.array);
						offset += attr.array.buffer.byteLength;
					});
				}
			}
		});


		return [library, [buffer]];
	}

	function deserialize(json)
	{
		window.console.log(json);

		var results = {
			objects: {},
			materials: {},
			geometry: {}
		};

		var root = null;

		// recreate materials
		for(var i in json.materials){
			results.materials[i] = new THREE.MeshBasicMaterial({color: json.materials[i].color});
		}

		// recreate geometry
		for(var i in json.geometry)
		{
			var geo = new THREE.BufferGeometry();

			for(var j in json.geometry[i])
			{
				// rebuild buffer attribute
				var attrRec = json.geometry[i][j];
				var type = window[attrRec.type+'Array'];
				var arr = new type(json.buffer, attrRec.offset, attrRec.length);
				var attr = new THREE.BufferAttribute(arr, attrRec.stride);

				geo.addAttribute(j, attr);
			}

			results.geometry[i] = geo;
		}

		// recreate object hierarchy
		for(var i in json.objects)
		{
			var objRec = json.objects[i];

			if( json.meshes[i] )
			{
				var meshRec = json.meshes[i];
				var obj = new THREE.Mesh(results.geometry[meshRec.geometry], results.materials[meshRec.material]);
			}
			else
				var obj = new THREE.Object3D();

			// fill in user data
			obj.name = objRec.name;
			obj.userData = objRec.userData;

			// fill in transform info
			obj.matrix.fromArray(objRec.transform);
			obj.matrix.decompose(obj.position, obj.quaternion, obj.scale);

			// reconstruct hierarchy
			if(results.objects[objRec.parent])
				results.objects[objRec.parent].add(obj);
			else
				root = obj;

			objRec.children.forEach(function(child){
				if(results.objects[child])
					obj.add( results.objects[child] );
			});

			results.objects[i] = obj;
		}

		return root;
	}

	function handleWorkerMessage(evt)
	{
		var loader = new THREE.PDBLoader();
		loader.load(evt.data, function(model)
		{
			var serial = serialize(model);
			var json = serial[0];
			var buffers = serial[1];
			postMessage({type: 'model', data: json}, buffers);
		});
	}

	try {
		onmessage = handleWorkerMessage;
	}
	catch(e){
		if( !/onmessage is not defined$/.test(e.toString()) )
			throw e;
	}
	

})(window.THREE);

