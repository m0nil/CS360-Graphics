////////////////////////////////////////////////////////////////////////
//  A simple WebGL program to draw a 3D cube wirh basic interaction.
//

var gl;
var canvas;
var MatrixStack = [];

var buf;
var indexBuf;
var cubeNormalBuf;
var spBuf;
var spIndexBuf;
var spNormalBuf;

var spVerts = [];
var spIndicies = [];
var spNormals = [];

var aPositionLocation;
var aNormalLocation;
var uColorLocation;
var uPMatrixLocation;
var uMMatrixLocation;
var uVMatrixLocation;
var uLightPosLocation;
var uAmbientColorLocation;

var scene = 0;
var degree1 = 0.0; //to be removed
var degree0 = 0.0; //to be removed

var degree1_left = 0.0;
var degree0_left = 0.0;
var degree1_center = 0.0;
var degree0_center = 0.0;
var degree1_right = 0.0;
var degree0_right = 0.0;

var prevMouseX = 0.0;
var prevMouseY = 0.0;

// initialize model, view, and projection matrices
var vMatrix = mat4.create(); // view matrix
var mMatrix = mat4.create(); // model matrix
var pMatrix = mat4.create(); //projection matrix
var nMatrix = mat4.create(); //normal matrix

var ambientcolor = [1,1,1];
var lightPos = [10.0, 0.0, 20.0];
// specify camera/eye coordinate system parameters
var eyePos = [0.0, 0.0, 2.0];
var COI = [0.0, 0.0, 0.0];
var viewUp = [0.0, 1.0, 0.0];

///////////////////FLAT SHADING////////////////////////
// Vertex shader code
const flatVertexShaderCode = `#version 300 es
in vec3 aPosition;
uniform mat4 uMMatrix;
uniform mat4 uPMatrix;
uniform mat4 uVMatrix;
out mat4 viewMatrix;
out vec3 vertex_pos_eye;
void main() {
  mat4 projectionModelView;
	projectionModelView=uPMatrix*uVMatrix*uMMatrix;
  gl_Position = projectionModelView*vec4(aPosition,1.0);
  viewMatrix = uVMatrix;
  vertex_pos_eye = vec3(uVMatrix*uMMatrix*vec4(aPosition,1.0));
  gl_PointSize=3.0;
}`;
// Fragment shader code
const flatFragShaderCode = `#version 300 es
precision mediump float;
in vec3 vertex_pos_eye;
in mat4 viewMatrix;
out vec4 fragColor;
uniform vec4 objColor;
vec3 normal;
uniform vec3 ulightpos;
uniform vec3 uAmbientColor;
void main() {
  normal = normalize(cross(dFdx(vertex_pos_eye), dFdy(vertex_pos_eye)));
  vec3 light = normalize(vec3(viewMatrix * vec4(ulightpos,1.0)) - vertex_pos_eye);
  vec3 reflection = normalize(-reflect(light,normal));
  vec3 view_vector = normalize(-vertex_pos_eye);
  float diffuse = max(dot(normal,light),0.0);
  float ambient = 0.2;
  float cos_phi = max(dot(reflection,view_vector),0.0);
  float specular = 1.0*pow(cos_phi,20.0);
  fragColor = vec4(ambient*uAmbientColor,1.0)+(diffuse) * objColor + specular * vec4(1.0,1.0,1.0,1.0);
}`;

///////////////////GOURAUD SHADING////////////////////////
const perVertVertexShaderCode = `#version 300 es
in vec3 aPosition;
in vec3 aNormal;
uniform mat4 uMMatrix;
uniform mat4 uPMatrix;
uniform mat4 uVMatrix;
uniform vec3 ulightpos;
uniform vec3 uAmbientColor;
uniform vec4 objColor;
out vec4 fcolor;
void main() {
  mat4 projectionModelView;
  projectionModelView=uPMatrix*uVMatrix*uMMatrix;
  gl_Position = projectionModelView*vec4(aPosition,1.0);
  vec3 normal = normalize(transpose(inverse(mat3(uVMatrix*uMMatrix))) * aNormal);
  vec3 vertex_pos_eye = vec3(uVMatrix*uMMatrix*vec4(aPosition,1.0));
  vec3 light = normalize(vec3(uVMatrix*vec4(ulightpos,1.0))-vertex_pos_eye);
  vec3 reflection = normalize(-reflect(light,normal));
  vec3 view_vector = normalize(-vertex_pos_eye);
  float diffuse = max(dot(normal,light),0.0);
  float ambient = 0.1;
  float cos_phi = max(dot(reflection,view_vector),0.0);
  float specular = 1.0*pow(cos_phi,20.0);
  fcolor = vec4(ambient*uAmbientColor,1.0)+(diffuse) * objColor + specular * vec4(1.0,1.0,1.0,1.0);
}`;

const perVertFragShaderCode = `#version 300 es
precision mediump float;
in vec4 fcolor;
out vec4 fragColor;
void main() {
  fragColor = vec4(vec3(fcolor),1.0);
}`;

///////////////////PHONG SHADING////////////////////////
const perFragVertexShaderCode =  `#version 300 es
in vec3 aPosition;
in vec3 aNormal;
uniform mat4 uMMatrix;
uniform mat4 uPMatrix;
uniform mat4 uVMatrix;
uniform vec3 ulightpos;
out vec3 normal;
out vec3 vertex_pos_eye;
out vec3 light;
void main() {
  mat4 projectionModelView;
  projectionModelView=uPMatrix*uVMatrix*uMMatrix;
  gl_Position = projectionModelView*vec4(aPosition,1.0);
  normal = normalize(transpose(inverse(mat3(uVMatrix*uMMatrix))) * aNormal);
  vertex_pos_eye = vec3(uVMatrix*uMMatrix*vec4(aPosition,1.0));
  light = normalize(vec3(uVMatrix*vec4(ulightpos,1.0))-vertex_pos_eye);
}`;
const perFragFragShaderCode = `#version 300 es
precision mediump float;
in vec3 normal;
in vec3 vertex_pos_eye;
in vec3 light;
out vec4 fragColor;
uniform vec4 objColor;
uniform vec3 uAmbientColor;
void main() {
  vec3 reflection = normalize(-reflect(light,normal));
  vec3 view_vector = normalize(-vertex_pos_eye);
  float diffuse = max(dot(normal,light),0.0);
  float ambient = 0.2;
  float cos_phi = max(dot(reflection,view_vector),0.0);
  float specular = 1.0*pow(cos_phi,30.0);
  fragColor = vec4(ambient*uAmbientColor,1.0)+(diffuse) * objColor + specular * vec4(1.0,1.0,1.0,1.0);
}`;

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

function initShaders(vertexShaderCode, fragShaderCode) {
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
  } catch (e) { }
  if (!gl) {
    alert("WebGL initialization failed");
  }
}

function degToRad(degrees) {
  return (degrees * Math.PI) / 180;
}

function pushMatrix(stack, m) {
  //necessary because javascript only does shallow push
  var copy = mat4.create(m);
  stack.push(copy);
}

function popMatrix(stack) {
  if (stack.length > 0) return stack.pop();
  else console.log("stack has no matrix to pop!");
}

function initSphere(nslices, nstacks, radius) {
  var theta1, theta2;

  for (i = 0; i < nslices; i++) {
    spVerts.push(0);
    spVerts.push(-radius);
    spVerts.push(0);

    spNormals.push(0);
    spNormals.push(-1.0);
    spNormals.push(0);
  }

  for (j = 1; j < nstacks - 1; j++) {
    theta1 = (j * 2 * Math.PI) / nslices - Math.PI / 2;
    for (i = 0; i < nslices; i++) {
      theta2 = (i * 2 * Math.PI) / nslices;
      spVerts.push(radius * Math.cos(theta1) * Math.cos(theta2));
      spVerts.push(radius * Math.sin(theta1));
      spVerts.push(radius * Math.cos(theta1) * Math.sin(theta2));

      spNormals.push(Math.cos(theta1) * Math.cos(theta2));
      spNormals.push(Math.sin(theta1));
      spNormals.push(Math.cos(theta1) * Math.sin(theta2));
    }
  }

  for (i = 0; i < nslices; i++) {
    spVerts.push(0);
    spVerts.push(radius);
    spVerts.push(0);

    spNormals.push(0);
    spNormals.push(1.0);
    spNormals.push(0);
  }

  // setup the connectivity and indices
  for (j = 0; j < nstacks - 1; j++)
    for (i = 0; i <= nslices; i++) {
      var mi = i % nslices;
      var mi2 = (i + 1) % nslices;
      var idx = (j + 1) * nslices + mi;
      var idx2 = j * nslices + mi;
      var idx3 = j * nslices + mi2;
      var idx4 = (j + 1) * nslices + mi;
      var idx5 = j * nslices + mi2;
      var idx6 = (j + 1) * nslices + mi2;

      spIndicies.push(idx);
      spIndicies.push(idx2);
      spIndicies.push(idx3);
      spIndicies.push(idx4);
      spIndicies.push(idx5);
      spIndicies.push(idx6);
    }
}

function initSphereBuffer() {
  var nslices = 30; // use even number
  var nstacks = nslices / 2 + 1;
  var radius = 1.0;
  initSphere(nslices, nstacks, radius);

  spBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, spBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(spVerts), gl.STATIC_DRAW);
  spBuf.itemSize = 3;
  spBuf.numItems = nslices * nstacks;

  spNormalBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, spNormalBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(spNormals), gl.STATIC_DRAW);
  spNormalBuf.itemSize = 3;
  spNormalBuf.numItems = nslices * nstacks;

  spIndexBuf = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, spIndexBuf);
  gl.bufferData(
    gl.ELEMENT_ARRAY_BUFFER,
    new Uint32Array(spIndicies),
    gl.STATIC_DRAW
  );
  spIndexBuf.itemsize = 1;
  spIndexBuf.numItems = (nstacks - 1) * 6 * (nslices + 1);
}

function drawSphere(color) {
  gl.bindBuffer(gl.ARRAY_BUFFER, spBuf);
  gl.vertexAttribPointer(
    aPositionLocation,
    spBuf.itemSize,
    gl.FLOAT,
    false,
    0,
    0);
  gl.bindBuffer(gl.ARRAY_BUFFER, spNormalBuf);
  gl.vertexAttribPointer(
    aNormalLocation,
    spNormalBuf.itemSize,
    gl.FLOAT,
    false,
    0,
    0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, spIndexBuf);

  gl.uniform4fv(uColorLocation, color);
  gl.uniform3fv(uLightPosLocation, lightPos);
  gl.uniform3fv(uAmbientColorLocation, ambientcolor);
  gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);
  gl.uniformMatrix4fv(uVMatrixLocation, false, vMatrix);
  gl.uniformMatrix4fv(uPMatrixLocation, false, pMatrix);

  gl.drawElements(gl.TRIANGLES, spIndexBuf.numItems, gl.UNSIGNED_INT, 0);
  // gl.drawArrays(gl.TRIANGLE_STRIP, 0, spBuf.numItems);


}
// Cube generation function with normals
function initCubeBuffer() {
  var vertices = [
    // Front face
    -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
    // Back face
    -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5,
    // Top face
    -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
    // Bottom face
    -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5,
    // Right face
    0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5,
    // Left face
    -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5,
  ];
  buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
  buf.itemSize = 3;
  buf.numItems = vertices.length / 3;

  var normals = [
    // Front face
    0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0,
    // Back face
    0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0,
    // Top face
    0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0,
    // Bottom face
    0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0,
    // Right face
    1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0,
    // Left face
    -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0,
  ];
  cubeNormalBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cubeNormalBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);
  cubeNormalBuf.itemSize = 3;
  cubeNormalBuf.numItems = normals.length / 3;


  var indices = [
    0,
    1,
    2,
    0,
    2,
    3, // Front face
    4,
    5,
    6,
    4,
    6,
    7, // Back face
    8,
    9,
    10,
    8,
    10,
    11, // Top face
    12,
    13,
    14,
    12,
    14,
    15, // Bottom face
    16,
    17,
    18,
    16,
    18,
    19, // Right face
    20,
    21,
    22,
    20,
    22,
    23, // Left face
  ];
  indexBuf = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuf);
  gl.bufferData(
    gl.ELEMENT_ARRAY_BUFFER,
    new Uint16Array(indices),
    gl.STATIC_DRAW
  );
  indexBuf.itemSize = 1;
  indexBuf.numItems = indices.length;
}
function drawCube(color) {
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.vertexAttribPointer(
    aPositionLocation,
    buf.itemSize,
    gl.FLOAT,
    false,
    0,
    0
  );
  gl.bindBuffer(gl.ARRAY_BUFFER,cubeNormalBuf);
  gl.vertexAttribPointer(
    aNormalLocation,
    cubeNormalBuf.itemSize,
    gl.FLOAT,
    false,
    0,
    0
  );
  // draw elementary arrays - triangle indices
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuf);

  gl.uniform4fv(uColorLocation, color);
  gl.uniform3fv(uLightPosLocation, lightPos);
  gl.uniform3fv(uAmbientColorLocation, ambientcolor);
  gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);
  gl.uniformMatrix4fv(uVMatrixLocation, false, vMatrix);
  gl.uniformMatrix4fv(uPMatrixLocation, false, pMatrix);

  gl.drawElements(gl.TRIANGLES, indexBuf.numItems, gl.UNSIGNED_SHORT, 0);
  // gl.drawArrays(gl.LINE_STRIP, 0, buf.numItems); // show lines
  //gl.drawArrays(gl.POINTS, 0, buf.numItems); // show points
}

//////////////////////////////////////////////////////////////////////
//Main drawing routine
function drawLeftScene() {
  // set up the view matrix, multiply into the modelview matrix
  mat4.identity(vMatrix);
  vMatrix = mat4.lookAt(eyePos, COI, viewUp, vMatrix);

  //set up perspective projection matrix
  mat4.identity(pMatrix);
  mat4.perspective(50, 1.0, 0.1, 1000, pMatrix);

  //set up the model matrix
  mat4.identity(mMatrix);
  // mat3.identity(nMatrix);
  // transformations applied here on model matrix
  mMatrix = mat4.translate(mMatrix, [0.0, -0.2, 0.0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(degree0_left), [0, 1, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(degree1_left), [1, 0, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(10), [1, 0, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(-60), [0, 1, 0]);

  pushMatrix(MatrixStack, mMatrix);
  mMatrix = mat4.translate(mMatrix, [0.0, 0.5, 0.0]);
  mMatrix = mat4.scale(mMatrix, [0.27, 0.27, 0.27]);
  var color = [0, 0.35, 0.68, 1];
  drawSphere(color);
  mMatrix = popMatrix(MatrixStack);

  pushMatrix(MatrixStack, mMatrix);
  mMatrix = mat4.translate(mMatrix, [0.0, -0.125, 0.0]);
  mMatrix = mat4.scale(mMatrix, [0.43, 0.75, 0.5]);
  drawCube([0.68, 0.68, 0.49, 1]);
  mMatrix = popMatrix(MatrixStack);

}
function drawCenterScene() {
  mat4.identity(vMatrix);
  vMatrix = mat4.lookAt(eyePos, COI, viewUp, vMatrix);

  //set up perspective projection matrix
  mat4.identity(pMatrix);
  mat4.perspective(50, 1.0, 0.1, 1000, pMatrix);

  //set up the model matrix and normal matrix
  mat4.identity(mMatrix);
  mat3.identity(nMatrix);
  // transformations applied here on model matrix
  mMatrix = mat4.rotate(mMatrix, degToRad(degree0_center), [0, 1, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(degree1_center), [1, 0, 0]);
  // mMatrix = mat4.translate(mMatrix, [0.0, -0.4, 0.0]);
  // mMatrix = mat4.scale(mMatrix, [0.7, 0.7, 0.7]);

  // rotation to get the default position
  mMatrix = mat4.rotate(mMatrix, 0.05, [0, 1, 0]);

  mMatrix = mat4.scale(mMatrix, [0.95, 0.95, 0.95]);

  pushMatrix(MatrixStack, mMatrix);
  // Bottom cube
  mMatrix = mat4.translate(mMatrix, [-0.3, -0.05, 0.1]);
  mMatrix = mat4.scale(mMatrix, [0.4, 0.4, 0.4]);
  mMatrix = mat4.rotate(mMatrix, 0.5, [1, 0, 0]);
  mMatrix = mat4.rotate(mMatrix, -0.45, [0, 0, 1]);
  mMatrix = mat4.rotate(mMatrix, -0.5, [0, 1, 0]);

  diffuseColor = [0, 0.52, 0];
  drawCube([0, 0.52, 0, 1]);

  mMatrix = popMatrix(MatrixStack);
  pushMatrix(MatrixStack, mMatrix);
  // Bottom sphere
  mMatrix = mat4.translate(mMatrix, [0, -0.45, 0.1]);
  mMatrix = mat4.scale(mMatrix, [0.35, 0.35, 0.35]);

  diffuseColor = [0.73, 0.73, 0.73];
  drawSphere([0.73, 0.73, 0.73, 1]);
  mMatrix = popMatrix(MatrixStack);



  pushMatrix(MatrixStack, mMatrix);
  // Mid sphere
  mMatrix = mat4.translate(mMatrix, [-0.15, 0.2, 0.25]);
  mMatrix = mat4.scale(mMatrix, [0.2, 0.2, 0.2]);

  diffuseColor = [0.73, 0.73, 0.73];
  drawSphere([0.73, 0.73, 0.73, 1]);
  mMatrix = popMatrix(MatrixStack);

  pushMatrix(MatrixStack, mMatrix);
  //Mid cube
  mMatrix = mat4.translate(mMatrix, [0.1, 0.4, 0.3]);
  mMatrix = mat4.scale(mMatrix, [0.30, 0.30, 0.30]);
  mMatrix = mat4.rotate(mMatrix, 0.5, [1, 0, 0]);
  mMatrix = mat4.rotate(mMatrix, 0.5, [0, 0, 1]);
  mMatrix = mat4.rotate(mMatrix, 0.2, [0, 1, 0]);

  diffuseColor = [0, 0.52, 0];
  drawCube([0, 0.52, 0, 1]);

  mMatrix = popMatrix(MatrixStack);

  pushMatrix(MatrixStack, mMatrix);
  mMatrix = mat4.translate(mMatrix, [-0.02, 0.6, 0.4]);
  mMatrix = mat4.scale(mMatrix, [0.125, 0.125, 0.125]);

  diffuseColor = [0.73, 0.73, 0.73];
  drawSphere([0.73, 0.73, 0.73, 1]);
  mMatrix = popMatrix(MatrixStack);
}

function drawRightScene() {
  // set up the view matrix, multiply into the modelview matrix
  mat4.identity(vMatrix);
  vMatrix = mat4.lookAt(eyePos, COI, viewUp, vMatrix);

  //set up perspective projection matrix
  mat4.identity(pMatrix);
  mat4.perspective(50, 1.0, 0.1, 1000, pMatrix);

  //set up the model matrix
  mat4.identity(mMatrix);

  // transformations applied here on model matrix
  mMatrix = mat4.rotate(mMatrix, degToRad(degree0_right), [0, 1, 0]);
  mMatrix = mat4.rotate(mMatrix, degToRad(degree1_right), [1, 0, 0]);

  // Bottom sphere and first cuboid
  pushMatrix(MatrixStack, mMatrix);
  mMatrix = mat4.translate(mMatrix, [0, -0.59, 0.1]);
  mMatrix = mat4.scale(mMatrix, [0.2, 0.2, 0.2]); // Scaled down the sphere

  diffuseColor = [0, 0.69, 0.14];
  drawSphere([0, 0.69, 0.14, 1]);
  mMatrix = popMatrix(MatrixStack);

  pushMatrix(MatrixStack, mMatrix);
  mMatrix = mat4.translate(mMatrix, [0.01, -0.38, 0.1]);
  mMatrix = mat4.rotate(mMatrix, Math.PI / 4, [1, 1, 1]);
  mMatrix = mat4.rotate(mMatrix, -0.6, [0, 0, 1]);
  mMatrix = mat4.rotate(mMatrix, 0.1, [0, 1, 0]);
  mMatrix = mat4.rotate(mMatrix, -0.1, [1, 0, 0]);
  mMatrix = mat4.scale(mMatrix, [1.35, 0.03, 0.25]);

  diffuseColor = [0.93, 0.04, 0.07];
  drawCube([0.93, 0.04, 0.07, 1]);

  mMatrix = popMatrix(MatrixStack);
  // Left sphere
  pushMatrix(MatrixStack, mMatrix);
  mMatrix = mat4.translate(mMatrix, [-0.3, -0.21, 0.4]);
  mMatrix = mat4.scale(mMatrix, [0.15, 0.15, 0.15]);

  diffuseColor = [0.26, 0.27, 0.53];
  drawSphere([0.26, 0.27, 0.53, 1]);
  mMatrix = popMatrix(MatrixStack);

  // Right sphere
  pushMatrix(MatrixStack, mMatrix);
  mMatrix = mat4.translate(mMatrix, [0.3, -0.21, -0.2]);
  mMatrix = mat4.scale(mMatrix, [0.16, 0.16, 0.16]);

  diffuseColor = [0.1, 0.32, 0.3];
  drawSphere([0.1, 0.32, 0.3, 1]);
  mMatrix = popMatrix(MatrixStack);

  // Left cuboid
  pushMatrix(MatrixStack, mMatrix);
  mMatrix = mat4.translate(mMatrix, [-0.3, -0.07, 0.45]);
  mMatrix = mat4.rotate(mMatrix, 3 * Math.PI / 4, [1, 1, 1]);
  mMatrix = mat4.rotate(mMatrix, -1.6, [0, 0, 1]);
  mMatrix = mat4.rotate(mMatrix, 0.6, [0, 1, 0]);
  mMatrix = mat4.rotate(mMatrix, 0.2, [1, 0, 0]);
  mMatrix = mat4.scale(mMatrix, [0.8, 0.03, 0.4]);

  diffuseColor = [0.7, 0.6, 0.0];
  drawCube([0.7, 0.6, 0.0, 1]);

  mMatrix = popMatrix(MatrixStack);

  // Right cuboid
  pushMatrix(MatrixStack, mMatrix);
  mMatrix = mat4.translate(mMatrix, [0.3, -0.07, -0.2]);
  mMatrix = mat4.rotate(mMatrix, 3 * Math.PI / 4, [1, 1, 1]);
  mMatrix = mat4.rotate(mMatrix, -1.6, [0, 0, 1]);
  mMatrix = mat4.rotate(mMatrix, 0.6, [0, 1, 0]);
  mMatrix = mat4.rotate(mMatrix, 0.2, [1, 0, 0]);
  mMatrix = mat4.scale(mMatrix, [0.9, 0.03, 0.4]);

  diffuseColor = [0.18, 0.62, 0];
  drawCube([0.18, 0.62, 0, 1]);

  mMatrix = popMatrix(MatrixStack);

  // Top sphere
  pushMatrix(MatrixStack, mMatrix);
  mMatrix = mat4.translate(mMatrix, [0, 0.48, 0.1]);
  mMatrix = mat4.scale(mMatrix, [0.2, 0.2, 0.2]);

  diffuseColor = [0.54, 0.54, 0.67];
  drawSphere([0.54, 0.54, 0.67, 1]);
  mMatrix = popMatrix(MatrixStack);

  // Top cuboid
  pushMatrix(MatrixStack, mMatrix);
  mMatrix = mat4.translate(mMatrix, [0.01, 0.265, 0.1]);
  mMatrix = mat4.rotate(mMatrix, Math.PI / 4, [1, 1, 1]);
  mMatrix = mat4.rotate(mMatrix, -0.57, [0, 0, 1]);
  mMatrix = mat4.rotate(mMatrix, 0.12, [0, 1, 0]);
  mMatrix = mat4.rotate(mMatrix, -0.25, [1, 0, 0]);
  mMatrix = mat4.scale(mMatrix, [1.35, 0.03, 0.25]);

  diffuseColor = [0.93, 0.04, 0.07];
  drawCube([0.93, 0.04, 0.07, 1]);

  mMatrix = popMatrix(MatrixStack);
  // Upper-left sphere
  pushMatrix(MatrixStack, mMatrix);
  mMatrix = mat4.translate(mMatrix, [-0.3, 0.08, 0.4]);
  mMatrix = mat4.scale(mMatrix, [0.16, 0.16, 0.16]);

  diffuseColor = [0.69, 0, 0.69];
  drawSphere([0.69, 0, 0.69, 1]);
  mMatrix = popMatrix(MatrixStack);

  // Upper-right sphere
  pushMatrix(MatrixStack, mMatrix);
  mMatrix = mat4.translate(mMatrix, [0.3, 0.1, -0.2]);
  mMatrix = mat4.scale(mMatrix, [0.17, 0.17, 0.17]);

  diffuseColor = [0.65, 0.47, 0.12];
  drawSphere([0.65, 0.47, 0.12, 1]);
  mMatrix = popMatrix(MatrixStack);


}
function setAttributes(shaderProgram) {
  aPositionLocation = gl.getAttribLocation(shaderProgram, "aPosition");
  aNormalLocation = gl.getAttribLocation(shaderProgram, "aNormal");
  uMMatrixLocation = gl.getUniformLocation(shaderProgram, "uMMatrix");
  uVMatrixLocation = gl.getUniformLocation(shaderProgram, "uVMatrix");
  uPMatrixLocation = gl.getUniformLocation(shaderProgram, "uPMatrix");
  uColorLocation = gl.getUniformLocation(shaderProgram, "objColor");
  uLightPosLocation = gl.getUniformLocation(shaderProgram,"ulightpos");
  uAmbientColorLocation = gl.getUniformLocation(shaderProgram,"uAmbientColor");
  gl.enableVertexAttribArray(aPositionLocation);
  gl.enableVertexAttribArray(aNormalLocation);
} 
function drawScene() {
  gl.enable(gl.SCISSOR_TEST);
  //need to divide canvas into 3 viewports left center and right
  //left viewport
  gl.viewport(0, 0, gl.viewportWidth / 3, gl.viewportHeight);
  gl.scissor(0, 0, gl.viewportWidth / 3, gl.viewportHeight);
  gl.clearColor(0.85, 0.85, 0.95, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  shaderProgram = flatShaderProgram;
  gl.useProgram(shaderProgram);
  setAttributes(shaderProgram);
  gl.enable(gl.DEPTH_TEST);

  drawLeftScene();
  //center viewport
  gl.viewport(gl.viewportWidth / 3, 0, gl.viewportWidth / 3, gl.viewportHeight);
  gl.scissor(gl.viewportWidth / 3, 0, gl.viewportWidth / 3, gl.viewportHeight);
  gl.clearColor(0.95, 0.85, 0.85, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  shaderProgram = perVertShaderProgram;
  gl.useProgram(shaderProgram);
  setAttributes(shaderProgram);
  gl.enable(gl.DEPTH_TEST);
  drawCenterScene();
  //right viewport
  gl.viewport((gl.viewportWidth / 3) * 2, 0, gl.viewportWidth / 3, gl.viewportHeight);
  gl.scissor((gl.viewportWidth / 3) * 2, 0, gl.viewportWidth / 3, gl.viewportHeight);
  gl.clearColor(0.85, 0.95, 0.85, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  shaderProgram = perFragShaderProgram;
  gl.useProgram(shaderProgram);
  setAttributes(shaderProgram);
  gl.enable(gl.DEPTH_TEST);
  drawRightScene();
}

function onMouseDown(event) {
  document.addEventListener("mousemove", onMouseMove, false);
  document.addEventListener("mouseup", onMouseUp, false);
  document.addEventListener("mouseout", onMouseOut, false);

  if (
    event.layerX <= canvas.width &&
    event.layerX >= 0 &&
    event.layerY <= canvas.height &&
    event.layerY >= 0
  ) {
    prevMouseX = event.clientX;
    prevMouseY = canvas.height - event.clientY;
    if (prevMouseX >=50 && prevMouseX <= canvas.width/3+50 )scene = 1;
    else if (prevMouseX >= canvas.width/3+50 && prevMouseX <= 2*canvas.width/3+50) scene = 2;
    else if (prevMouseX >= 2*canvas.width/3+50 && prevMouseX <= canvas.width)scene = 3;
  }
}

function onMouseMove(event) {
  // make mouse interaction only within canvas
  if (
    event.layerX <= canvas.width+50 &&
    event.layerX >= 50 &&
    event.layerY <= canvas.height+50 &&
    event.layerY >= 50
  ) {
    var mouseX = event.clientX;
    var diffX1 = mouseX - prevMouseX;
    prevMouseX = mouseX;
    var mouseY = canvas.height - event.clientY;
    var diffY2 = mouseY - prevMouseY;
    prevMouseY = mouseY;
    if (scene == 1 && mouseX >= 50 && mouseX <= canvas.width / 3 + 50){
      degree0_left = degree0_left + diffX1 / 5;
      degree1_left = degree1_left - diffY2 / 5;
    }
    else if (scene == 2 && mouseX >= canvas.width / 3 + 50 && mouseX <= 2 * canvas.width / 3 + 50){
      degree0_center = degree0_center + diffX1 / 5;
      degree1_center = degree1_center - diffY2 / 5;
    }
    else if (scene == 3 && mouseX >= 2 * canvas.width / 3 + 50 && mouseX <= canvas.width){
      degree0_right = degree0_right + diffX1 / 5;
      degree1_right = degree1_right - diffY2 / 5;
    }
    drawScene();
  }
}

function onMouseUp(event) {
  document.removeEventListener("mousemove", onMouseMove, false);
  document.removeEventListener("mouseup", onMouseUp, false);
  document.removeEventListener("mouseout", onMouseOut, false);
}

function onMouseOut(event) {
  document.removeEventListener("mousemove", onMouseMove, false);
  document.removeEventListener("mouseup", onMouseUp, false);
  document.removeEventListener("mouseout", onMouseOut, false);
}

// This is the entry point from the html
function webGLStart() {
  canvas = document.getElementById("assn2");
  document.addEventListener("mousedown", onMouseDown, false);

  // initialize WebGL
  initGL(canvas);
  initCubeBuffer();
  initSphereBuffer();
  // initialize shader program
  flatShaderProgram = initShaders(flatVertexShaderCode, flatFragShaderCode);
  perVertShaderProgram = initShaders(perVertVertexShaderCode, perVertFragShaderCode);
  perFragShaderProgram = initShaders(perFragVertexShaderCode, perFragFragShaderCode);

   const lightSlider = document.getElementById('light-slider');

   let lightX = parseFloat(lightSlider.value);

   lightSlider.addEventListener('input', (event) => {
       lightX = parseFloat(event.target.value);
       lightPos = [lightX, 3.0, 20.0];

       drawScene();
   });

   const cameraSlider = document.getElementById('camera-slider');

   let cameraZ = parseFloat(cameraSlider.value);

   cameraSlider.addEventListener('input', (event) => {
       cameraZ = parseFloat(event.target.value);
       eyePos = [0.0, 0.0, cameraZ];
       drawScene();
   });
  //enable the attribute arrays
  // gl.enableVertexAttribArray(aPositionLocation);
  // gl.enableVertexAttribArray(aNormalLocation);
  //initialize buffers for the square
  
  drawScene();
}
