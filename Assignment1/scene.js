////////////////////////////////////////////////////////////////////////
// A simple WebGL program to draw simple 2D shapes.
//

var gl;
var color;
var animation;
var matrixStack = [];
var dark_brown = [0.4, 0.2, 0.0, 1.0];
var light_brown = [0.6, 0.4, 0.2, 1.0];
var rotationAngle = 0.0;
var star_size=1.0;
var it = 0.08;
var boat1 = 0.0;
var boat2 = 0.0;
var dis1 = -1, dis2 =-1;
// mMatrix is called the model matrix, transforms objects
// from local object space to world space.
var mMatrix = mat4.create();
var uMMatrixLocation;

var circleBuf;
var circleIndexBuf;

var sqVertexPositionBuffer;
var sqVertexIndexBuffer;

var moonRayBuf;
var moonRayIndexBuf;

var aPositionLocation;
var uColorLoc;


var mode='s'; //The default mode is solid , can be changed to wireframe by pressing 'w' and points by pressing 'p'

const vertexShaderCode = `#version 300 es
in vec2 aPosition;
uniform mat4 uMMatrix;

void main() {
  gl_Position = uMMatrix*vec4(aPosition,0.0,1.0);
  gl_PointSize = 2.9;
}`;

const fragShaderCode = `#version 300 es
precision mediump float;
out vec4 fragColor;

uniform vec4 color;

void main() {
  fragColor = color;
}`;

function pushMatrix(stack, m) {
  //necessary because javascript only does shallow push
  var copy = mat4.create(m);
  stack.push(copy);
}

function popMatrix(stack) {
  if (stack.length > 0) return stack.pop();
  else console.log("stack has no matrix to pop!");
}

function degToRad(degrees) {
  return (degrees * Math.PI) / 180;
}

function vertexShaderSetup(vertexShaderCode) {
  shader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(shader, vertexShaderCode);
  gl.compileShader(shader);
  // Error check whether the shader is compiled correctly
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert(gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

function fragmentShaderSetup(fragShaderCode) {
  shader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(shader, fragShaderCode);
  gl.compileShader(shader);
  // Error check whether the shader is compiled correctly
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert(gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

function initShaders() {
  shaderProgram = gl.createProgram();

  var vertexShader = vertexShaderSetup(vertexShaderCode);
  var fragmentShader = fragmentShaderSetup(fragShaderCode);

  // attach the shaders
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  //link the shader program
  gl.linkProgram(shaderProgram);

  // check for compilation and linking status
  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    console.log(gl.getShaderInfoLog(vertexShader));
    console.log(gl.getShaderInfoLog(fragmentShader));
  }

  //finally use the program.
  gl.useProgram(shaderProgram);

  return shaderProgram;
}

function initGL(canvas) {
  try {
    gl = canvas.getContext("webgl2"); // the graphics webgl2 context
    gl.viewportWidth = canvas.width; // the width of the canvas
    gl.viewportHeight = canvas.height; // the height
  } catch (e) {}
  if (!gl) {
    alert("WebGL initialization failed");
  }
}
function initCircleBuffer() {
    //want to make circle using 100 points on the circumference and one in the center
    const numPoints = 50;
    const circleVertices = new Float32Array(2 * (numPoints + 1));
    const circleIndices = new Uint16Array(3 * numPoints);
    for (let i = 0; i < numPoints; i++) {
      const theta = (2 * Math.PI * i) / numPoints;
      const x = Math.cos(theta);
      const y = Math.sin(theta);
      circleVertices[2 * i] = x/2;
      circleVertices[2 * i + 1] = y/2;
      circleIndices[3 * i] = 2*numPoints;
      circleIndices[3 * i + 1] = i;
      circleIndices[3 * i + 2] = i + 1;
    }
    circleVertices[2 * numPoints] = 0;
    circleVertices[2 * numPoints + 1] = 0;
    circleIndices[3 * numPoints - 1] = 0;
    circleBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, circleBuf);
    gl.bufferData(gl.ARRAY_BUFFER, circleVertices, gl.STATIC_DRAW);
    circleBuf.itemSize = 2;
    circleBuf.numItems = numPoints + 1;
    circleIndexBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, circleIndexBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, circleIndices, gl.STATIC_DRAW);
    circleIndexBuf.itemsize = 1;
    circleIndexBuf.numItems = 3 * numPoints;
    // buffer for point locations
  }
  function drawCircle(color, mMatrix) {
    gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);
  
    // buffer for point locations
    gl.bindBuffer(gl.ARRAY_BUFFER, circleBuf);
    gl.vertexAttribPointer(
      aPositionLocation,
      circleBuf.itemSize,
      gl.FLOAT,
      false,
      0,
      0
    );
  
    // buffer for point indices
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, circleIndexBuf);
  
    gl.uniform4fv(uColorLoc, color);
  
    // now draw the square curently a solid circle
    if (mode == 's'){
    gl.drawElements(
      gl.TRIANGLES,
      circleIndexBuf.numItems,
      gl.UNSIGNED_SHORT,
      0
    );
}
else if (mode == 'w') {
    gl.drawElements(
      gl.LINE_LOOP,
      circleIndexBuf.numItems,
      gl.UNSIGNED_SHORT,
      0
    );
}
else if (mode == 'p') {
    gl.drawArrays(
        gl.POINTS,
        0,
        circleBuf.numItems
    );
}
  }
function initSquareBuffer() {
  // buffer for point locations
  const sqVertices = new Float32Array([
    0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5,
  ]);
  sqVertexPositionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, sqVertexPositionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, sqVertices, gl.STATIC_DRAW);
  sqVertexPositionBuffer.itemSize = 2;
  sqVertexPositionBuffer.numItems = 4;

  // buffer for point indices
  const sqIndices = new Uint16Array([0, 1, 2, 0, 2, 3]);
  sqVertexIndexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sqVertexIndexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, sqIndices, gl.STATIC_DRAW);
  
  sqVertexIndexBuffer.itemsize = 1;
  sqVertexIndexBuffer.numItems = 6;
}

function drawSquare(color, mMatrix) {
  gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);

  // buffer for point locations
  gl.bindBuffer(gl.ARRAY_BUFFER, sqVertexPositionBuffer);
  gl.vertexAttribPointer(
    aPositionLocation,
    sqVertexPositionBuffer.itemSize,
    gl.FLOAT,
    false,
    0,
    0
  );

  // buffer for point indices
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sqVertexIndexBuffer);

  gl.uniform4fv(uColorLoc, color);

  // now draw the square
  if (mode == 's') {
  gl.drawElements(
    gl.TRIANGLES,
    sqVertexIndexBuffer.numItems,
    gl.UNSIGNED_SHORT,
    0
  );
}
else if (mode == 'w') {
  gl.drawElements(
    gl.LINE_LOOP,
    sqVertexIndexBuffer.numItems,
    gl.UNSIGNED_SHORT,
    0
  );
}
else if (mode == 'p') {
    gl.drawArrays(
        gl.POINTS,
        0,
        sqVertexPositionBuffer.numItems
    );
}
}

function initTriangleBuffer() {
  // buffer for point locations
  const triangleVertices = new Float32Array([0.0, 0.5, -0.5, -0.5, 0.5, -0.5]);
  triangleBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, triangleBuf);
  gl.bufferData(gl.ARRAY_BUFFER, triangleVertices, gl.STATIC_DRAW);
  triangleBuf.itemSize = 2;
  triangleBuf.numItems = 3;

  // buffer for point indices
  const triangleIndices = new Uint16Array([0, 1, 2]);
  triangleIndexBuf = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleIndexBuf);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, triangleIndices, gl.STATIC_DRAW);
  triangleIndexBuf.itemsize = 1;
  triangleIndexBuf.numItems = 3;
}
function initMoonRayBuffer() {
    // buffer for point locations
    const numPoints = 8;
    const moonRayVertices = new Float32Array(2 * (numPoints + 1));
    const moonRayIndices = new Uint16Array(2 * numPoints);
    for (let i = 0; i < numPoints; i++) {
        const theta = (2 * Math.PI * i) / numPoints;
        const x = Math.cos(theta);
        const y = Math.sin(theta);
        moonRayVertices[2 * i] = x/2;
        moonRayVertices[2 * i + 1] = y/2;
        moonRayIndices[2 * i] = 2*numPoints;
        moonRayIndices[2 * i + 1] = i;
    }
    moonRayVertices[2 * numPoints] = 0;
    moonRayVertices[2 * numPoints + 1] = 0;
    moonRayBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, moonRayBuf);
    gl.bufferData(gl.ARRAY_BUFFER, moonRayVertices, gl.STATIC_DRAW);
    moonRayBuf.itemSize = 2;
    moonRayBuf.numItems = numPoints + 1;
    moonRayIndexBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, moonRayIndexBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, moonRayIndices, gl.STATIC_DRAW);
    moonRayIndexBuf.itemsize = 1;
    moonRayIndexBuf.numItems = 2 * numPoints;
}
function drawMoonRay(color, mMatrix) {
    gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);
  
    // buffer for point locations
    gl.bindBuffer(gl.ARRAY_BUFFER, moonRayBuf);
    gl.vertexAttribPointer(
      aPositionLocation,
      moonRayBuf.itemSize,
      gl.FLOAT,
      false,
      0,
      0
    );
  
    // buffer for point indices
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, moonRayIndexBuf);
  
    gl.uniform4fv(uColorLoc, color);
  
    // now draw the square

    if (mode == 'w' || mode == 's') {
      gl.drawElements(
        gl.LINE_STRIP,
        moonRayIndexBuf.numItems,
        gl.UNSIGNED_SHORT,
        0
      );
    }
    else if (mode == 'p') {
        gl.drawArrays(
            gl.POINTS,
            0,
            moonRayIndexBuf.numItems
        );
    }
}
function drawTriangle(color, mMatrix) {
  gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);

  // buffer for point locations
  gl.bindBuffer(gl.ARRAY_BUFFER, triangleBuf);
  gl.vertexAttribPointer(
    aPositionLocation,
    triangleBuf.itemSize,
    gl.FLOAT,
    false,
    0,
    0
  );

  // buffer for point indices
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleIndexBuf);

  gl.uniform4fv(uColorLoc, color);

  // now draw the square
  if (mode == 's') {
    gl.drawElements(
      gl.TRIANGLES,
      triangleIndexBuf.numItems,
      gl.UNSIGNED_SHORT,
      0
    );
  }
  else if (mode == 'w') {
    gl.drawElements(
      gl.LINE_LOOP,
      triangleIndexBuf.numItems,
      gl.UNSIGNED_SHORT,
      0
    );
  }
  else if (mode == 'p') {
      gl.drawArrays(
          gl.POINTS,
          0,
          triangleIndexBuf.numItems
      );
  }
}
function drawNightSky(){
    //initialize the model matrix to identity matrix
    mat4.identity(mMatrix);
    //push the matrix to the stack
    pushMatrix(matrixStack, mMatrix);
    //local translation operation for the sqaure
    mMatrix = mat4.translate(mMatrix, [0.0, 0.0, 0]);
    //local scale operation for the square
    mMatrix = mat4.scale(mMatrix, [5.0, 3.0, 3.0]);
    color = [0.0, 0.0, 0.0, 1];
    drawSquare(color, mMatrix);
    mMatrix = popMatrix(matrixStack);
}
function drawMountain(x_trans,y_trans,x_scale,y_scale,color,rotate){
    //we will make triangle mountain
    mat4.identity(mMatrix);
    pushMatrix(matrixStack, mMatrix);
    //local translation operation for the triangle
    mMatrix = mat4.translate(mMatrix,[x_trans,y_trans,0]);
    if (rotate){
        mMatrix = mat4.rotate(mMatrix, degToRad(12), [0, 0, 1]);
    }
    //local scale operation for the triangle
    mMatrix = mat4.scale(mMatrix,[x_scale,y_scale,1.0]);
    drawTriangle(color,mMatrix);
    mMatrix = popMatrix(matrixStack);
}
function drawMoon(rotationAngle){
    //we need to make 8 rays which are 45 degrees apart and very thin lines centered at the moon
    mat4.identity(mMatrix);
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [-0.65, 0.85, 0]);
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.scale(mMatrix, [0.22, 0.22, 1.0]);
    color = [1.0, 1.0, 1.0, 1];
    drawCircle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);
    mMatrix = mat4.rotate(mMatrix, degToRad(rotationAngle), [0, 0, 1]);
    mMatrix = mat4.scale(mMatrix, [0.3, 0.3, 1.0]);
    drawMoonRay([1.0, 1.0, 1.0, 1], mMatrix);
}
function drawCloud(){
    //we will make 3 circles for the cloud
    mat4.identity(mMatrix);
    pushMatrix(matrixStack, mMatrix);
    //grey color
    color = [0.8, 0.8, 0.8, 1.0];
    // local translation operation for the circle
    mMatrix = mat4.translate(mMatrix, [-0.75, 0.55, 0]);
    // local scale operation for the circle
    mMatrix = mat4.scale(mMatrix, [0.46, 0.26, 1.0]);
    drawCircle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);
    color = [1.0, 1.0, 1.0, 1.0];
    pushMatrix(matrixStack, mMatrix);
    // local translation operation for the circle
    mMatrix = mat4.translate(mMatrix, [-0.55, 0.52, 0]);
    // local scale operation for the circle
    mMatrix = mat4.scale(mMatrix, [0.4, 0.22, 1.0]);
    drawCircle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);
    color = [0.8, 0.8, 0.8, 1.0];
    pushMatrix(matrixStack, mMatrix);
    // local translation operation for the circle
    mMatrix = mat4.translate(mMatrix, [-0.3, 0.52, 0]);
    // local scale operation for the circle
    mMatrix = mat4.scale(mMatrix, [0.25, 0.16, 1.0]);
    drawCircle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);
}
function drawPark() {
    // initialize the model matrix to identity matrix
    mat4.identity(mMatrix);
    pushMatrix(matrixStack, mMatrix);
    color = [0.15, 0.61, 0, 0.7];
    mMatrix = mat4.translate(mMatrix, [0.0, -0.6, 0]);
    mMatrix = mat4.scale(mMatrix, [3.0, 1.2, 1.0]);
    drawSquare(color, mMatrix);
    mMatrix = popMatrix(matrixStack);
}
function drawWhiteLine(x,y,color){
    // initialize the model matrix to identity matrix
    mat4.identity(mMatrix);
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [x, y, 0]);
    mMatrix = mat4.scale(mMatrix, [0.4, 0.005, 1.0]);
    drawSquare(color, mMatrix);
    mMatrix = popMatrix(matrixStack);
}
function drawRiver() {
    // initialize the model matrix to identity matrix
    mat4.identity(mMatrix);
    pushMatrix(matrixStack, mMatrix);
    color = [0.0, 0.0, 1.0, 1.0];
    mMatrix = mat4.translate(mMatrix, [0.0, -0.17, 0]);
    mMatrix = mat4.scale(mMatrix, [3.0, 0.26, 1.0]);
    drawSquare(color, mMatrix);
    mMatrix = popMatrix(matrixStack);
    drawWhiteLine(0.67,-0.27,[0.7,0.7,0.7,1.0]);
    drawWhiteLine(0.0,-0.1,[0.8,0.8,0.8,1.0]);
    drawWhiteLine(-0.6,-0.20,[1,1,1,1.0]);
}
function drawTree(){
    pushMatrix(matrixStack, mMatrix);
    color = [0.15, 0.4, 0.05, 0.9];
    mMatrix = mat4.translate(mMatrix, [0.55, 0.45, 0]);
    mMatrix = mat4.scale(mMatrix, [0.35, 0.3, 1.0]);
    drawTriangle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    color = [0.18, 0.58, 0.1, 0.9];
    mMatrix = mat4.translate(mMatrix, [0.55, 0.5, 0]);
    mMatrix = mat4.scale(mMatrix, [0.375, 0.3, 1.0]);
    drawTriangle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    color = [0.30, 0.60, 0, 0.9];
    mMatrix = mat4.translate(mMatrix, [0.55, 0.55, 0]);
    mMatrix = mat4.scale(mMatrix, [0.4, 0.3, 1.0]);
    drawTriangle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    // trunk of the tree
    pushMatrix(matrixStack, mMatrix);
    color = [0.57, 0.26, 0.15, 1.0];
    mMatrix = mat4.translate(mMatrix, [0.55, 0.14, 0]);
    mMatrix = mat4.scale(mMatrix, [0.04, 0.33, 1.0]);
    drawSquare(color, mMatrix);
    mMatrix = popMatrix(matrixStack);
}
function drawTrees(){
    mat4.identity(mMatrix);
    pushMatrix(matrixStack, mMatrix);
    //we will be drawing 3 trees
    mMatrix = mat4.translate(mMatrix, [0.33, 0, 0]);
    mMatrix = mat4.scale( mMatrix,[0.85,0.85,0]);
    drawTree();
    mMatrix = popMatrix(matrixStack);
    pushMatrix(matrixStack, mMatrix);
    drawTree();
    mMatrix = popMatrix(matrixStack);
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [-0.15, 0, 0]);
    mMatrix = mat4.scale( mMatrix,[0.8, 0.8,0]);
    drawTree();
    mMatrix = popMatrix(matrixStack);

}
function drawStar(star_size){
    //initialize the model matrix to identity matrix
    mMatrix = mat4.scale(mMatrix, [0.01*star_size, 0.01*star_size, 1.0]);
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0.0, 0.0, 0]);
    color = [1.0, 1.0, 1.0, 1];
    drawCircle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0.6, 0, 0]);
    mMatrix = mat4.rotate(mMatrix, degToRad(-90), [0, 0, 1]);
    color = [1.0, 1.0, 1.0, 1];
    drawTriangle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [-0.6, 0, 0]);
    mMatrix = mat4.rotate(mMatrix, degToRad(90), [0, 0, 1]);
    color = [1.0, 1.0, 1.0, 1];
    drawTriangle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0.0, -0.6, 0]);
    mMatrix = mat4.rotate(mMatrix, degToRad(180), [0, 0, 1]);
    color = [1.0, 1.0, 1.0, 1];
    drawTriangle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0.0, 0.6, 0]);
    color = [1.0, 1.0, 1.0, 1];
    drawTriangle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);
}
function drawStars(star_size){
    mat4.identity(mMatrix);
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0.05, 0.67, 0]);
    drawStar(star_size);
    mMatrix = popMatrix(matrixStack);
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [-0.05, 0.56, 0]);
    drawStar(star_size);
    mMatrix = popMatrix(matrixStack);
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [-0.13, 0.75, 0]);
    drawStar(star_size*1.2);
    mMatrix = popMatrix(matrixStack);
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0.3, 0.75, 0]);
    drawStar(star_size*1.5);
    mMatrix = popMatrix(matrixStack);
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0.5, 0.9, 0]);
    drawStar(0.9*star_size);
    mMatrix = popMatrix(matrixStack);

}

function drawPath() {
    // initialize the model matrix to identity matrix
    mat4.identity(mMatrix);
    pushMatrix(matrixStack, mMatrix);
    color = [0.30, 0.50, 0, 0.8];
    mMatrix = mat4.translate(mMatrix, [0.5, -0.8, 0]);
    mMatrix = mat4.rotate(mMatrix, 7.2, [0, 0, 1]);
    mMatrix = mat4.scale(mMatrix, [1.6, 2, 1.0]);
    drawTriangle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);
}
function drawWindmill(){

    //one circle 4 blades and a trunk

    pushMatrix(matrixStack, mMatrix);
    // black color trunk
    color = [0.2, 0.2, 0.2, 1.0];
    mMatrix = mat4.translate(mMatrix, [0.0, -0.35, 0]);
    mMatrix = mat4.scale(mMatrix, [0.05, 0.7, 1.0]);
    drawSquare(color, mMatrix);
    mMatrix = popMatrix(matrixStack); 
    mMatrix=mat4.scale(mMatrix, [0.70, 0.70, 1.0]);
    mMatrix=mat4.rotate(mMatrix, degToRad(-rotationAngle*2), [0, 0, 1]);
    pushMatrix(matrixStack, mMatrix);
    //yellow color blades
    color = [0.8, 0.8, 0.0, 1.0];
    mMatrix = mat4.translate(mMatrix, [0.0, 0.25, 0]);
    mMatrix=mat4.rotate(mMatrix, degToRad(180), [0, 0, 1]);
    mMatrix=mat4.scale(mMatrix, [0.15, 0.5, 1.0]);
    drawTriangle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0.25, 0.0, 0]);
    mMatrix=mat4.rotate(mMatrix, degToRad(90), [0, 0, 1]);
    mMatrix=mat4.scale(mMatrix, [0.15, 0.5, 1.0]);
    drawTriangle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0.0, -0.25, 0]);
    mMatrix=mat4.rotate(mMatrix, degToRad(0), [0, 0, 1]);
    mMatrix=mat4.scale(mMatrix, [0.15, 0.5, 1.0]);
    drawTriangle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [-0.25, 0.0, 0]);
    mMatrix=mat4.rotate(mMatrix, degToRad(-90), [0, 0, 1]);
    mMatrix=mat4.scale(mMatrix, [0.15, 0.5, 1.0]);
    drawTriangle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);
    //center circle
    color = [0.0, 0.0, 0.0, 1.0];
    mat4.scale(mMatrix, [0.12, 0.12, 1.0]);
    drawCircle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);
    pushMatrix(matrixStack, mMatrix);
    
    // trunk of the tree  
}
function drawWindmills(){
    mat4.identity(mMatrix);
    pushMatrix(matrixStack, mMatrix);
    mMatrix=mat4.translate(mMatrix, [0.5, 0.02, 0]);
    mMatrix=mat4.scale(mMatrix, [0.5, 0.5, 1.0]);
    drawWindmill();
    mMatrix = popMatrix(matrixStack);
    pushMatrix(matrixStack, mMatrix);
    mMatrix=mat4.translate(mMatrix, [0.7, -0.085, 0]);
    mMatrix=mat4.scale(mMatrix, [0.7, 0.7, 1.0]);
    drawWindmill();

}
function drawBush(){
    pushMatrix(matrixStack, mMatrix);
    color = [0, 0.7, 0, 0.9];
    mMatrix = mat4.translate(mMatrix, [-1, -0.55, 0]);
    mMatrix = mat4.scale(mMatrix, [0.15, 0.11, 1.0]);
    drawCircle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    color = [0, 0.4, 0, 0.9];
    mMatrix = mat4.translate(mMatrix, [-0.72, -0.55, 0]);
    mMatrix = mat4.scale(mMatrix, [0.14, 0.1, 1.0]);
    drawCircle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    color = [0, 0.51, 0, 0.9]
    mMatrix = mat4.translate(mMatrix, [-0.86, -0.53, 0]);
    mMatrix = mat4.scale(mMatrix, [0.26, 0.18, 1.0]);
    drawCircle(color, mMatrix);
    mMatrix = popMatrix(matrixStack); 
}
function drawBushes(){
    mat4.identity(mMatrix);
    pushMatrix(matrixStack, mMatrix);
    drawBush();
    mMatrix = popMatrix(matrixStack);
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0.8,0,1]);
    mMatrix = mat4.scale(mMatrix, [1.02,1.02,1.0]);
    drawBush();
    mMatrix = popMatrix(matrixStack);
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [1.48,-0.13,1]);
    mMatrix = mat4.scale(mMatrix, [1.6,1.6,1.0]);
    drawBush();
    mMatrix = popMatrix(matrixStack);
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [2.15,0.25,1]);
    mMatrix = mat4.scale(mMatrix, [1.3,1.3,1.0]);
    drawBush();

}
function drawtrapezium(color){
    // we make a trapezium using 1 square and 2 triangles and both triangles overlap the square
    // mat4.identity(mMatrix);
    mMatrix = mat4.scale(mMatrix, [0.5, 0.5, 1.0]);
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.scale(mMatrix,[2.0,1.0,1.0]);
    drawSquare( color, mMatrix);
    mMatrix = popMatrix(matrixStack);
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [1, 0, 0]);
    mMatrix = mat4.scale(mMatrix, [0.5, 1, 1.0]);
    drawTriangle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [-1, 0, 0]);
    mMatrix = mat4.scale(mMatrix, [0.5, 1, 1.0]);
    drawTriangle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);
}
function drawBoat(color){
    
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.rotate(mMatrix, degToRad(180), [0, 0, 1]);
    mMatrix = mat4.scale(mMatrix, [0.35, 0.2, 1.0]);
    drawtrapezium([0.8, 0.8, 0.8, 1.0]);
    mMatrix = popMatrix(matrixStack);
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0.0, 0.23, 0]);
    mMatrix = mat4.scale(mMatrix, [0.015, 0.35, 1.0]);
    drawSquare([0.0, 0.0, 0.0, 1.0], mMatrix);
    mMatrix = popMatrix(matrixStack);
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0.134, 0.23, 0]);
    mMatrix = mat4.scale(mMatrix, [0.25, 0.28, 1.0]);
    mMatrix = mat4.rotate(mMatrix, degToRad(-90), [0, 0, 1]);
    drawTriangle(color, mMatrix);
    mMatrix = popMatrix(matrixStack);
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [-0.075, 0.21, 0]);
    mMatrix = mat4.rotate(mMatrix, degToRad(-25), [0, 0, 1]);
    mMatrix = mat4.scale(mMatrix, [0.005, 0.36, 1.0]);
    drawSquare([0.0, 0.0, 0.0, 1.0], mMatrix);
    mMatrix = popMatrix(matrixStack);
}
function drawBoats(){
    mat4.identity(mMatrix);
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [boat1, -0.07, 0]);
    mMatrix = mat4.scale(mMatrix, [0.5, 0.5, 1.0]);
    drawBoat([0.7, 0.0, 0.7, 1.0]);
    mMatrix = popMatrix(matrixStack);
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [boat2, -0.17, 0]);
    mMatrix = mat4.scale(mMatrix, [0.8, 0.8, 1.0]);
    drawBoat([1.0, 0.0, 0.0, 1.0]);
    mMatrix = popMatrix(matrixStack);
    
}
function drawHouse(){
    mat4.identity(mMatrix);
    mat4.translate(mMatrix, [-0.5, -0.55, 0]);
    mat4.scale(mMatrix, [0.6, 0.6, 1.0]);
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.scale(mMatrix, [0.8, 0.4, 0]);
    drawSquare([0.8,0.8,0.8,1.0], mMatrix);
    mMatrix = popMatrix(matrixStack);
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0.0, 0.35, 0]);
    mMatrix = mat4.scale(mMatrix, [0.8, 0.6, 1.0]);
    drawtrapezium([0.9,0.3,0.0,1.0]);
    mMatrix = popMatrix(matrixStack);
    
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [-0.2, 0.05, 0]);
    mMatrix = mat4.scale(mMatrix, [0.1, 0.1, 1.0]);
    drawSquare([0.8,0.6,0,0.85],mMatrix);
    mMatrix = popMatrix(matrixStack);
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0.2, 0.05, 0]);
    mMatrix = mat4.scale(mMatrix, [0.1, 0.1, 1.0]);
    drawSquare([0.8,0.6,0,0.85],mMatrix);
    mMatrix = popMatrix(matrixStack);
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0.0, -0.075, 0]);
    mMatrix = mat4.scale(mMatrix, [0.1, 0.25, 1.0]);
    drawSquare([0.8,0.6,0,0.85],mMatrix);
    mMatrix = popMatrix(matrixStack);

}
function drawCar(){
    mat4.identity(mMatrix);
    mMatrix = mat4.translate(mMatrix, [-0.45, -0.85, 0]);
    mMatrix = mat4.scale(mMatrix, [0.6, 0.6, 1.0]);
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0.0, 0.12, 0]);
    mMatrix = mat4.scale(mMatrix, [0.6, 0.4, 1.0]);
    drawCircle([0.0, 0.0,0.5, 1.0], mMatrix);
    mMatrix = popMatrix(matrixStack);
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.scale(mMatrix, [0.8, 0.4, 1.0]); 
    drawtrapezium([0.0, 0.0, 0.9, 0.7]);
    mMatrix = popMatrix(matrixStack);
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0.0, 0.17, 0]);
    mMatrix = mat4.scale(mMatrix, [0.4, 0.15, 1.0]);
    drawSquare([0.9, 0.9, 0.9, 1], mMatrix);
    mMatrix = popMatrix(matrixStack);
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [-0.24, -0.13, 0]);
    mMatrix = mat4.scale(mMatrix, [0.15, 0.15, 1.0]);
    drawCircle([0.0, 0.0, 0.0, 1.0], mMatrix);
    mMatrix = popMatrix(matrixStack);
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0.24, -0.13, 0]);
    mMatrix = mat4.scale(mMatrix, [0.15, 0.15, 1.0]);
    drawCircle([0.0, 0.0, 0.0, 1.0], mMatrix);
    mMatrix = popMatrix(matrixStack);
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [-0.24, -0.13, 0]);
    mMatrix = mat4.scale(mMatrix, [0.12, 0.12, 1.0]);
    drawCircle([0.7, 0.7, 0.7, 1.0], mMatrix);
    mMatrix = popMatrix(matrixStack);
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0.24, -0.13, 0]);
    mMatrix = mat4.scale(mMatrix, [0.12, 0.12, 1.0]);
    drawCircle([0.7, 0.7, 0.7, 1.0], mMatrix);
    mMatrix = popMatrix(matrixStack);

    
}
////////////////////////////////////////////////////////////////////////

function drawScene() {
  gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
  gl.clearColor(0.9, 0.9, 0.8, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
 
   // stop the current loop of animation
   if (animation) {
    window.cancelAnimationFrame(animation);
  }

  var animate = function () {
    rotationAngle += 0.6;
    if (star_size>2.5){
        it = -it;

    }
    if (star_size<1.0){
        it = -it;
    }
    star_size += it;
    if(boat1 >0.87){
        dis1 = -1;
      }else if(boat1<-0.9){
        dis1=1;
      }
      boat1 += 0.004*dis1; 
  
      if(boat2 >0.8){
        dis2 = -1;
      }else if(boat2<-0.8){
        dis2=1;
      }
      boat2 += 0.004*dis2;
  
  // initialize the model matrix to identity matrix
  mat4.identity(mMatrix);
  drawNightSky();
  drawMoon(rotationAngle);
  drawCloud();
  drawMountain(-0.6, 0.09, 1.2, 0.4,dark_brown,false);
  drawMountain(-0.555, 0.095, 1.2, 0.4,light_brown,true);
  drawMountain(-0.076, 0.09, 1.8, 0.53,dark_brown,false);
  drawMountain(-0.0145, 0.096, 1.8, 0.53,light_brown,true);
  drawMountain(0.7, 0.12, 1.0, 0.3,light_brown,false); //right most mountain 
  drawPark();
  drawPath();
  drawRiver();
  drawTrees();
  drawStars(star_size);
  drawBoats();
    drawWindmills();
    drawBushes();
    drawHouse();
    drawCar();
  //// This translation applies to both the objects below
  //mMatrix = mat4.translate(mMatrix, [0.0, 0.2, 0]);
  animation = window.requestAnimationFrame(animate);
  };
    animate();
}

// This is the entry point from the html
function webGLStart() {
  var canvas = document.getElementById("scenery");
  initGL(canvas);
  shaderProgram = initShaders();

  //get locations of attributes declared in the vertex shader
  const aPositionLocation = gl.getAttribLocation(shaderProgram, "aPosition");

  uMMatrixLocation = gl.getUniformLocation(shaderProgram, "uMMatrix");

  //enable the attribute arrays
  gl.enableVertexAttribArray(aPositionLocation);

  uColorLoc = gl.getUniformLocation(shaderProgram, "color");

  initSquareBuffer();
  initTriangleBuffer();
  initCircleBuffer();
    initMoonRayBuffer();
  drawScene();
}
function changeView(alpha){
    mode = alpha;
    drawScene();
}