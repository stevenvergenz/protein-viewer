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
		['2M6C.pdb', '2VAA.pdb'],

		function(item, done)
		{
			console.log('loading', item);
			var molecule = new THREE.Object3D();
			var loader = new THREE.PDBLoader();
			loader.load('models/'+item, function(geometry, geometryBonds, json)
			{
				var bondGeometry = new THREE.BoxGeometry( 1, 1, 1 );
				var atomGeometry = new THREE.IcosahedronGeometry( .01, 0 );

				geometry.computeBoundingBox();
				geometry.computeBoundingSphere();
				var offset = geometry.center();
				console.log(offset);
				geometry.translate( -offset.x, -offset.y, -offset.z );
				var radius = geometry.boundingSphere.radius;
				geometry.scale(1/radius, 1/radius, 1/radius);

				//geometryBonds.translate( offset.x, offset.y, offset.z );

				for ( var i = 0; i < geometry.vertices.length; i ++ )
				{
					var position = geometry.vertices[ i ];
					var color = geometry.colors[ i ];
					var element = geometry.elements[ i ];

					var material = new THREE.MeshBasicMaterial( { color: color } );
					var object = new THREE.Mesh( atomGeometry, material );

					object.position.copy( position );
					//object.position.multiplyScalar( 0.05 );
					//object.scale.multiplyScalar( 25 );
					molecule.add( object );

					/*
					var atom = json.atoms[ i ];
					var text = document.createElement( 'div' );
					text.className = 'label';
					text.style.color = 'rgb(' + atom[ 3 ][ 0 ] + ',' + atom[ 3 ][ 1 ] + ',' + atom[ 3 ][ 2 ] + ')';
					text.textContent = atom[ 4 ];
					var label = new THREE.CSS2DObject( text );
					label.position.copy( object.position );
					root.add( label );
					*/
				}

				for ( var i = 0; i < geometryBonds.vertices.length; i += 2 )
				{
					var start = geometryBonds.vertices[ i ];
					var end = geometryBonds.vertices[ i + 1 ];
					start.multiplyScalar( 75 );
					end.multiplyScalar( 75 );

					var object = new THREE.Mesh( bondGeometry, new THREE.MeshBasicMaterial( 0xffffff ) );
					object.position.copy( start );
					object.position.lerp( end, 0.5 );
					object.scale.set( 5, 5, start.distanceTo( end ) );
					object.lookAt( end );
					//molecule.add( object );
				}

				done(null, molecule);
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
		renderer.setClearColor( 0x888888 );
		document.body.appendChild(renderer.domElement);

		camera = new THREE.PerspectiveCamera(90, 1, 0.01, 10000);
		camera.up.set(0,0,1);
		camera.position.set(0, -5, 1.5);
		camera.lookAt(new THREE.Vector3(0, 0, 0));
		root.add(camera);
	}

	done();
}


function setupEnclosure(done)
{
	if(altspace.inClient)
	{
		altspace.getEnclosure().then(function(e){
			//root.position.set(32, -151.25, 32);
			root.scale.multiplyScalar(e.pixelsPerMeter);
			root.rotation.set( -Math.PI/2, 0, 0 );
			done();
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

	window.molecule = results[0][0];
	root.add(results[0][0]);

	// start animating
	window.requestAnimationFrame(function animate(timestamp)
	{
		window.requestAnimationFrame(animate);
		scene.updateAllBehaviors();
		renderer.render(scene, camera);
	});
}

