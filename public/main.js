'use strict';

(function() {

  var WebVRConfig = {
  /**
   * webvr-polyfill configuration
   */
  // Forces availability of VR mode.
  //FORCE_ENABLE_VR: true, // Default: false.
  // Complementary filter coefficient. 0 for accelerometer, 1 for gyro.
  //K_FILTER: 0.98, // Default: 0.98.
  // How far into the future to predict during fast motion.
  //PREDICTION_TIME_S: 0.040, // Default: 0.040 (in seconds).
  // Flag to disable touch panner. In case you have your own touch controls
  //TOUCH_PANNER_DISABLED: true, // Default: false.
  // Enable yaw panning only, disabling roll and pitch. This can be useful for
  // panoramas with nothing interesting above or below.
  //YAW_ONLY: true, // Default: false.
  // Enable the deprecated version of the API (navigator.getVRDevices).
  //ENABLE_DEPRECATED_API: true, // Default: false.
  // Scales the recommended buffer size reported by WebVR, which can improve
  // performance. Making this very small can lower the effective resolution of
  // your scene.
  BUFFER_SCALE: 0.5, // default: 1.0
  // Allow VRDisplay.submitFrame to change gl bindings, which is more
  // efficient if the application code will re-bind it's resources on the
  // next frame anyway.
  // Dirty bindings include: gl.FRAMEBUFFER_BINDING, gl.CURRENT_PROGRAM,
  // gl.ARRAY_BUFFER_BINDING, gl.ELEMENT_ARRAY_BUFFER_BINDING,
  // and gl.TEXTURE_BINDING_2D for texture unit 0
  // Warning: enabling this might lead to rendering issues.
  //DIRTY_SUBMIT_FRAME_BINDINGS: true // default: false
  };


  var socket = io();
  var canvas = document.getElementsByClassName('whiteboard')[0];
  var colors = document.getElementsByClassName('color');
  //
  var context = canvas.getContext('2d');

    var current = {
    color: 'red'
  };
  var drawing = false;
  var addingParticle = false;

  function Player(xp,yp,zp, xdir, zdir, color, text) {

  }

  canvas.addEventListener('mousedown', onMouseDown, false);
  canvas.addEventListener('mouseup', onMouseUp, false);
  canvas.addEventListener('mouseout', onMouseUp, false);
  canvas.addEventListener('mousemove', throttle(onMouseMove, 10), false);

  for (var i = 0; i < colors.length; i++){
    colors[i].addEventListener('click', onColorUpdate, false);
  }

  socket.on('drawing', onDrawingEvent);

  socket.on('updateScene', onUpdateScene); 

  window.addEventListener('resize', onResize, false);

  // threejs setup //

  var scene = new THREE.Scene();

  /*
// A semi-transparent plane to make the background fade
  var plane = new THREE.Mesh( 
    new THREE.PlaneGeometry( window.innerWidth, 
                             window.innerHeight, 8,8 ), 
    new THREE.MeshBasicMaterial( { 
      transparent: true,
      opacity: 0.02,
      color: 0x000000 } ) );
  plane.position.z = -500;
  scene.add(plane);
  */

  //Light

  var bulbGeometry = new THREE.SphereGeometry( 0.02, 16, 8 );
  var bulbLight = new THREE.PointLight( 0xffee88, 5, 100, 2 );
  var bulbMat = new THREE.MeshStandardMaterial( {
    emissive: 0xffffee,
    emissiveIntensity: 1,
    color: 0x000000
  });
  bulbLight.add( new THREE.Mesh( bulbGeometry, bulbMat ) );
  bulbLight.position.set( 0, 0.2, 0 );
  //bulbLight.castShadow = true;
  scene.add( bulbLight );
  var hemiLight = new THREE.HemisphereLight( 0xddeeff, 0x0f0e0d, 0.12 );
  scene.add( hemiLight );

  var boxGeo = new THREE.BoxGeometry(6, 2, 6);
  var boxMat = new THREE.MeshStandardMaterial({
    color:0xffffff,
    side: THREE.BackSide });
  var boxMesh = new THREE.Mesh(boxGeo, boxMat);
  boxMesh.recieveShadow = true;
  scene.add(boxMesh);

  // Wood floor

  var floorMat = new THREE.MeshStandardMaterial( {
          roughness: 0.8,
          color: 0xffffff,
          metalness: 0.2,
          bumpScale: 0.0005
        });

  var textureLoader = new THREE.TextureLoader();
  textureLoader.load( "textures/hardwood2_diffuse.jpg", function( map ) {
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    map.anisotropy = 4;
    map.repeat.set( 10, 24 );
    floorMat.map = map;
    floorMat.needsUpdate = true;
  } );
  textureLoader.load( "textures/hardwood2_bump.jpg", function( map ) {
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    map.anisotropy = 4;
    map.repeat.set( 10, 24 );
    floorMat.bumpMap = map;
    floorMat.needsUpdate = true;
  } );
  textureLoader.load( "textures/hardwood2_roughness.jpg", function( map ) {
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    map.anisotropy = 4;
    map.repeat.set( 10, 24 );
    floorMat.roughnessMap = map;
    floorMat.needsUpdate = true;
  } );

  var floorGeometry = new THREE.PlaneBufferGeometry( 20, 20 );
  var floorMesh = new THREE.Mesh( floorGeometry, floorMat );
  floorMesh.receiveShadow = true;
  floorMesh.rotation.x = -Math.PI / 2.0;
  floorMesh.position.y = -0.9;
  scene.add( floorMesh );

  var geometry = new THREE.SphereGeometry( 4, 4, 4 );
  var material = new THREE.MeshNormalMaterial({depthTest:false});
  
  var partMeshes = new THREE.Group();
  scene.add( partMeshes );

  var camera = new THREE.PerspectiveCamera( 
    75, window.innerWidth/window.innerHeight, 0.1, 1000 );
  camera.position.x = 4*(Math.random()-0.5);
  camera.position.y = 0;
  camera.position.z = 4*(Math.random()-0.5);

  var renderer = new THREE.WebGLRenderer(
    { antialias: true } );
  renderer.setSize( window.innerWidth, window.innerHeight );
  renderer.physicallyCorrectLights = true;
  renderer.gammaInput = true;
  renderer.gammaOutput = true;
  renderer.shadowMap.enabled = true;
  renderer.toneMapping = THREE.ReinhardToneMapping;
  renderer.setPixelRatio( window.devicePixelRatio );
  document.body.appendChild( renderer.domElement );

  //

  // stores previous particle positions for
  // smooth interpolation
  const stateCount = 2;
  var particleStates = [];
  for (let i=0; i<stateCount; i++) particleStates.push([]);
  var stateIndex = 0;
  var lastStateUpdate = 0.0;
  var lastStateDelta = 0.0;


  onResize();
  animate();

  function animate() {

    requestAnimationFrame(animate);

    for (let i=0; i<particleStates[stateIndex].length; i++) {
      let pos = partMeshes.children[i].position;
      // grab particles current position, as well as previous
      let a = particleStates[stateIndex][i];
      let b = particleStates[(stateIndex+stateCount-1)%stateCount][i];
      let c = particleStates[(stateIndex+stateCount-2)%stateCount][i];
      let portion = (Date.now()-lastStateUpdate)/lastStateDelta;
      //portion = portion*portion*(3-2*portion); // cubic interpolation
      let firstDir = new THREE.Vector3(
        b.x-c.x,
        b.y-c.y,
        b.z-c.z);
      let secDir = new THREE.Vector3(
        a.x-b.x,
        a.y-b.y,
        a.z-b.z);

      pos.x = (1.0-portion)*a.x+portion*b.x;
      pos.y = (1.0-portion)*a.y+portion*b.y;
      pos.z = (1.0-portion)*a.z+portion*b.z;
    }

    renderer.render( scene, camera );
  }

  function drawLine(x0, y0, x1, y1, color, emit){
    context.clearRect(0,0,canvas.width, canvas.height);
    context.beginPath();
    context.moveTo(x0, y0);
    context.lineTo(x1, y1);
    context.strokeStyle = color;
    context.lineWidth = 2;
    context.stroke();
    context.closePath();
    /*
    if (!emit) { return; }
    var w = canvas.width;
    var h = canvas.height;
    
    socket.emit('drawing', {
      x0: x0 / w,
      y0: y0 / h,
      x1: x1 / w,
      y1: y1 / h,
      color: color
    });
    */
  }

  function onMouseDown(e){
    //drawing = true;
    addingParticle = true;
    current.x = e.clientX;
    current.y = e.clientY;
  }

  function onMouseUp(e){
    //if (!drawing) { return; }
    //drawing = false;
    //drawLine(current.x, current.y, e.clientX, e.clientY, current.color, true);
    if (!addingParticle) { return; }
    addingParticle = false;
    addParticle(current.x-window.innerWidth/2,
               -current.y+window.innerHeight/2,
                e.clientX-window.innerWidth/2,
               -e.clientY+window.innerHeight/2);
    context.clearRect(0,0,canvas.width, canvas.height);

  }

  function onMouseMove(e){
    //if (!drawing) { return; }
    if (addingParticle) {
      drawLine(current.x, current.y, e.clientX, e.clientY, current.color);
    }
    //if (!addingParticle) { return; }
    //drawLine(current.x, current.y, e.clientX, e.clientY, current.color, true);
    //current.x = e.clientX;
    //current.y = e.clientY;
  }

  function onColorUpdate(e){
    current.color = e.target.className.split(' ')[1];
  }

  // limit the number of events per second
  function throttle(callback, delay) {
    var previousCall = new Date().getTime();
    return function() {
      var time = new Date().getTime();

      if ((time - previousCall) >= delay) {
        previousCall = time;
        callback.apply(null, arguments);
      }
    };
  }

  function addParticle(ix, iy, fx, fy) {
    socket.emit('addParticle', 
      {
        ix, iy,
        fx, fy,
     //   current.color
      });
  }

  function onUpdateScene(parts) {

    particleStates[stateIndex] = parts;
    // Add new particles to old state
    for (let s of particleStates) {
      if (s.length < parts.length) fillState(s, parts);
    }

    while (parts.length > partMeshes.children.length ) {
      partMeshes.add(new THREE.Mesh( geometry, material ));
    }

    stateIndex = (stateIndex + 1)%stateCount;
    lastStateDelta = Date.now()-lastStateUpdate;
    lastStateUpdate = Date.now();

  }

  function fillState(s, parts) {
    let i = s.length;
    while (i<parts.length) {
      s.push(parts[i]);
      i++;
    }
  }

  function onDrawingEvent(data){
    var w = canvas.width;
    var h = canvas.height;
    drawLine(data.x0 * w, data.y0 * h, data.x1 * w, data.y1 * h, data.color);
  }

  // make the canvas fill its parent
  function onResize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

})();
