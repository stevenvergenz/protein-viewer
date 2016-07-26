'use strict';

// set up global variables
var sync, renderer, camera, model;
var scene = new THREE.Scene();
var root = new THREE.Object3D();
scene.add(root);

// start loading everything in the right order
async.parallel(
	[
		loadModels,
		setupRenderer,
		setupEnclosure
	],
	start
);

function loadModels(done)
{
	async.map(
		['2M6C.pdb' , '2VAA.pdb'],

		function(item, done)
		{
			var molecule = new THREE.Object3D();
			var loader = new THREE.PDBLoader();
			/*loader.load('models/'+item, function(geometry, geometryBonds, json)
			{
				var atomGeometry = new THREE.BoxGeometry( .01, .01, .01 );
				var bondGeometry = new THREE.BoxGeometry( .004, .004, 1 );

				geometry.computeBoundingBox();
				geometry.computeBoundingSphere();
				var offset = geometry.boundingBox.center();
				var radius = geometry.boundingSphere.radius;

				geometry.translate( -offset.x, -offset.y, -offset.z );
				geometry.scale(1/radius, 1/radius, 1/radius);

				geometryBonds.translate( -offset.x, -offset.y, -offset.z );
				geometryBonds.scale(1/radius, 1/radius, 1/radius);

				for ( var i = 0; i < geometry.vertices.length; i ++ )
				{
					var position = geometry.vertices[ i ];
					var color = geometry.colors[ i ];
					var element = geometry.elements[ i ];

					var material = new THREE.MeshBasicMaterial( { color: color } );
					var object = new THREE.Mesh( atomGeometry, material );

					object.position.copy( position );
					molecule.add( object );

				}

				for ( var i = 0; i < geometryBonds.vertices.length; i += 2 )
				{
					var start = geometryBonds.vertices[ i ];
					var end = geometryBonds.vertices[ i + 1 ];

					var object = new THREE.Mesh( bondGeometry, new THREE.MeshBasicMaterial({color: 0xffffff, wireframe: true}) );
					object.position.copy( start );
					object.position.lerp( end, 0.5 );
					object.scale.setZ( start.distanceTo( end ) );
					object.lookAt( end );
					molecule.add( object );
				}

				console.log(item+': '+geometry.vertices.length+' atoms, '+(geometryBonds.vertices.length/2)+' bonds');

				done(null, molecule);
			});*/
			loader.load('models/'+item, function(models)
			{
				var model = models[0];
				done(null, model);
			});
		},
		done
	);
}


function setupRenderer(done)
{
	if(altspace.inClient){
		renderer = altspace.getThreeJSRenderer();
	}
	else {
		// set up preview renderer, in case we're out of world
		renderer = new THREE.WebGLRenderer();
		renderer.setSize(720, 720);
		renderer.setClearColor( 0 );
		document.body.appendChild(renderer.domElement);

		//camera = new THREE.PerspectiveCamera(90, 1, 0.01, 10000);
		camera = new THREE.OrthographicCamera(-1.5, 1.5, 1.5, -1.5, 0.1, 100);
		camera.up.set(0,0,1);
		camera.position.set(1.4, 0, 1.5);
		camera.lookAt(new THREE.Vector3(0, 0, 1.5));
		root.add(camera);

		// add bounding box
		/*var box = new THREE.Mesh(
			new THREE.BoxGeometry(3,3,3),
			new THREE.MeshBasicMaterial({wireframe: true})
		);
		box.position.set(0,0,1.5);
		root.add(box);*/
	}

	done();
}


function setupEnclosure(done)
{
	if(altspace.inClient)
	{
		altspace.getEnclosure().then(function(e){
			root.position.setY(-e.innerHeight/2);
			root.scale.multiplyScalar(e.pixelsPerMeter);
			root.rotation.set( -Math.PI/2, 0, 0 );
			done(e.innerDepth===1);
		});
	}
	else {
		done();
	}
}

function start(err, results)
{
	if(err){
		console.error(err);
		return;
	}
	console.log(results);

	window.molecule = results[0][1];
	molecule.position.set(0,0,1.5);
	molecule.scale.multiplyScalar(0.04);
	root.add(molecule);


	// start animating
	window.requestAnimationFrame(function animate(timestamp)
	{
		window.requestAnimationFrame(animate);
		scene.updateAllBehaviors();
		renderer.render(scene, camera);
	});
}

