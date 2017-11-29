'use strict';

(function() {


  var socket = io();
  var canvas = document.getElementsByClassName('whiteboard')[0];
  var colors = document.getElementsByClassName('color');
  //
  var context = canvas.getContext('2d');

  // threejs setup //

  var scene = new THREE.Scene();

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

  var geometry = new THREE.SphereGeometry( 4, 4, 4 );
  var material = new THREE.MeshNormalMaterial({depthTest:false});
  
  var partMeshes = new THREE.Group();
  scene.add( partMeshes );

  var camera = new THREE.OrthographicCamera( 
    window.innerWidth / - 2,
    window.innerWidth / 2,
    window.innerHeight / 2,
    window.innerHeight / - 2,
    1, 1000 );
  camera.position.z = 100;

  var renderer = new THREE.WebGLRenderer(
    { antialias: true, preserveDrawingBuffer: true } );
  renderer.autoClear = false;
  renderer.setSize( window.innerWidth, window.innerHeight );
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

  var current = {
    color: 'red'
  };
  var drawing = false;
  var addingParticle = false;

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
