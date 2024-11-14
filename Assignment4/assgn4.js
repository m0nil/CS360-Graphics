var gl;
var canvas;
var matrixStack = [];

var aPositionLocation;
var aNormalLocation;
var aTexCoordLocation;

var uVMatrixLocation;
var uMMatrixLocation;
var uPMatrixLocation;
var uWNMatrixLocation;
var uLVMatrixLocation;

// For the teapot
var objVertexPositionBuffer;
var objVertexNormalBuffer;
var objVertexIndexBuffer;
var objVertexTextureBuffer;

// For cubes
var cubeBuf;
var cubeIndexBuf;
var cubeNormalBuf;
var cubeTexBuf;

// For spheres
var spBuf;
var spIndexBuf;
var spNormalBuf;
var spTexBuf;

var spVerts = [];
var spIndicies = [];
var spNormals = [];
var spTexCoords = [];

//for depth texture
var depthTexture;
var FBO;
var depthTextureSize = 5000;
var udepthTextureLocation;
// For Phong shading
var lightPosition = [1, 1.6, -0.7];
var ambientColor = [1, 1, 1];
var diffuseColor = [0.5, 0.5, 0.5];
var specularColor = [1.0, 1.0, 1.0];
// var color = [0.0,0.0,0.0];
var vMatrix = mat4.create(); // view matrix
var mMatrix = mat4.create(); // model matrix
var pMatrix = mat4.create(); //projection matrix
var wNMatrix = mat3.create(); // model matrix in world space
var lvMatrix = mat4.create(); // light view matrix
var temp = mat4.create();
var eyePos = [0,0.6,1];
var defaultEyePos = [0,0.6,1];

var uEyePosLocation;
var uLightPositionLocation;

// Animation - Rotation of Camera
var animate;
var animation;
var isAnimating = false; // Variable to track if the animation is active

// Camera rotation speed
var degree = 0.0;
var input_JSON = "./teapot.json";
////////////////////////////////////////////////////////////////////
const shadowVertexShaderCode = `#version 300 es
in vec3 aPosition;
in vec3 aNormal;
in vec2 aTexCoords;

uniform mat4 uMMatrix;
uniform mat4 uPMatrix;
uniform mat4 uVMatrix;
void main() {
    gl_Position = uPMatrix * uVMatrix * uMMatrix * vec4(aPosition, 1.0);
}`;
const shadowFragShaderCode = `#version 300 es
precision highp float;
uniform vec3 objColor;
out vec4 fragColor;
void main() {
    fragColor = vec4(objColor,1.0);
}`;
// For Phong shading, Reflection Mapping, 3D Texture Mapping
const renderVertexShaderCode = `#version 300 es
in vec3 aPosition;
in vec3 aNormal;
in vec2 aTexCoords;

uniform mat4 uMMatrix;
uniform mat4 uPMatrix;
uniform mat4 uVMatrix;

uniform mat4 uLVMatrix;
out vec3 v_worldPosition;
out vec3 v_worldNormal;
out mat4 vMat;
out vec3 normalEyeSpace;
out vec3 normal;

out vec3 vPosEyeSpace;

out vec2 fragTexCoord;
out vec4 shadowTexCoord;
void main() {
    const mat4 textureTransformMat = 
	mat4(0.5, 0.0, 0.0, 0.0,
		 0.0, 0.5, 0.0, 0.0,
		 0.0, 0.0, 0.5, 0.0,
		 0.5, 0.5, 0.5, 1.0);
	mat4 lightProjectionMat = textureTransformMat * uLVMatrix * uMMatrix;
    shadowTexCoord = lightProjectionMat * vec4(aPosition, 1.0);
    mat4 projectionModelView = uPMatrix * uVMatrix * uMMatrix;
    gl_Position =  projectionModelView * vec4(aPosition, 1.0);

    v_worldPosition = mat3(uMMatrix) * aPosition;

    gl_PointSize = 1.0;
    vPosEyeSpace = (uVMatrix * uMMatrix * vec4(aPosition, 1.0)).xyz;

    normalEyeSpace = normalize(mat3(uVMatrix * uMMatrix) * aNormal);
    normal =aNormal;
    vMat = uVMatrix;

    fragTexCoord = aTexCoords;
}`;

const renderFragShaderCode = `#version 300 es
precision mediump float;

uniform samplerCube cubeMap;

in vec3 v_worldPosition;
in vec3 v_worldNormal;
in vec3 normalEyeSpace;
in vec3 normal;
in vec2 fragTexCoord;
in vec4 shadowTexCoord;
in mat4 vMat;
uniform mat3 uWNMatrix;
in vec3 vPosEyeSpace;
uniform vec3 eyePos;
uniform vec3 uLightPosition;
uniform vec3 uAmbientColor;
uniform vec3 objColor;
uniform vec3 uSpecularColor;


uniform sampler2D imageTexture;


out vec4 fragColor;

void main() {
    //shadow calculation
    vec3 projectedTexCoords = shadowTexCoord.xyz / shadowTexCoord.w;
    float currentDepth = projectedTexCoords.z;

    float closestDepth = texture(imageTexture, projectedTexCoords.xy).r;
    float sF1 = currentDepth - 0.01 > closestDepth ? -0.1 : 0.8;
	float sF2 = currentDepth - 0.01 > closestDepth ? 0.3 : 1.0;
    // Phong Shading
    vec3 normal = normalize(uWNMatrix * normal);
    vec3 L = normalize(vec3(vMat*vec4(uLightPosition, 1)) - vPosEyeSpace);
    vec3 R= normalize(-reflect(L, normal));
    vec3 V = normalize(-vPosEyeSpace);
    vec3 diffuse = max(0.0, dot(L, normal))*objColor;
	vec3 specular = uSpecularColor * pow(max(0.0, dot(R, V)), 20.0);
	vec3 ambient = 0.3 * objColor;

	vec3 color = sF1*diffuse + sF2*specular + ambient;

	 fragColor = vec4(color, 1.0);

    // float diffuse = max(dot(normalEyeSpace, L), 0.0);
    // float specular = pow(max(dot(reflectionVector, V), 0.0), 24.0);
    // float ambient = 0.15;
    // vec3 fColor = uAmbientColor * ambient + objColor * diffuse + uSpecularColor * specular;
    
    // // look up texture color
    // vec4 textureColor =  texture(imageTexture, fragTexCoord); 
    // textureColor += vec4(fColor, 1.0);
    // vec4 refColor =vec4(fColor, 1.0);

    // // Blending texture mapping and reflection mapping
    // fragColor = refColor;
   
}`;
//////////////////////////////////////////////////////////////
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
function topMatrix(stack) {
	if (stack.length > 0) return mat4.create(stack[stack.length - 1]);
	else console.log("stack has no matrix to see!");
}


function passAttributes(color) {
    gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);
    gl.uniformMatrix4fv(uVMatrixLocation, false, vMatrix);
    gl.uniformMatrix4fv(uPMatrixLocation, false, pMatrix);
    gl.uniformMatrix4fv(uLVMatrixLocation, false, lvMatrix);
    
    mat4.multiply(vMatrix, mMatrix, temp);
    mat4.toInverseMat3(temp, wNMatrix);
    mat3.transpose(wNMatrix, wNMatrix);
    gl.uniformMatrix3fv(uWNMatrixLocation, false, wNMatrix);

    gl.uniform3fv(uEyePosLocation, eyePos);
    gl.uniform3fv(uLightPositionLocation, lightPosition);

    gl.uniform3fv(uAmbientColorLocation, new Float32Array(color));
    gl.uniform3fv(uDiffuseColorLocation, new Float32Array(color));
    gl.uniform3fv(uSpecularColorLocation, new Float32Array(specularColor));
}

function setAttributes() {
    //get locations of attributes declared in the vertex shader
    aPositionLocation = gl.getAttribLocation(shaderProgram, "aPosition");
    aNormalLocation = gl.getAttribLocation(shaderProgram, "aNormal");
    aTexCoordLocation = gl.getAttribLocation(shaderProgram, "aTexCoords");

    uMMatrixLocation = gl.getUniformLocation(shaderProgram, "uMMatrix");
    uPMatrixLocation = gl.getUniformLocation(shaderProgram, "uPMatrix");
    uVMatrixLocation = gl.getUniformLocation(shaderProgram, "uVMatrix");
    uWNMatrixLocation = gl.getUniformLocation(shaderProgram, "uWNMatrix");
    uLVMatrixLocation = gl.getUniformLocation(shaderProgram, "uLVMatrix");

    uEyePosLocation = gl.getUniformLocation(shaderProgram, "eyePos");
    uLightPositionLocation = gl.getUniformLocation(shaderProgram, 'uLightPosition');
    uAmbientColorLocation = gl.getUniformLocation(shaderProgram, 'uAmbientColor');
    uDiffuseColorLocation = gl.getUniformLocation(shaderProgram, 'objColor');
    uSpecularColorLocation = gl.getUniformLocation(shaderProgram, 'uSpecularColor');

    udepthTextureLocation = gl.getUniformLocation(shaderProgram, "imageTexture")
    //enable the attribute arrays
    gl.enableVertexAttribArray(aPositionLocation);
    gl.enableVertexAttribArray(aNormalLocation);
    gl.enableVertexAttribArray(aTexCoordLocation);
}
function updateCamera() {
    // Calculate the new camera position (for rotation around the room)
    const cosTheta = Math.cos(degToRad(degree));
    const sinTheta = Math.sin(degToRad(degree));

    eyePos[0] = defaultEyePos[0] * cosTheta - defaultEyePos[2] * sinTheta;
    eyePos[2] = defaultEyePos[0] * sinTheta + defaultEyePos[2] * cosTheta;

    // Recalculate the view matrix
    vMatrix=mat4.lookAt(eyePos, [0, 0, 0], [0, 1, 0], vMatrix);
}

//
function initDepthFBO() {
    depthTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, depthTexture);
    gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.DEPTH_COMPONENT24,
        depthTextureSize,
        depthTextureSize,
        0,
        gl.DEPTH_COMPONENT,
        gl.UNSIGNED_INT,
        null
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    FBO = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, FBO);
    FBO.width = depthTextureSize;
    FBO.height = depthTextureSize;
    gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.DEPTH_ATTACHMENT,
        gl.TEXTURE_2D,
        depthTexture,
        0
    );
    var FPOstatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (FPOstatus != gl.FRAMEBUFFER_COMPLETE) {
        console.error("GL_FRAMEBUFFER_COMPLETE failed, CANNOT use FBO");
    }
}
// Loading Teapot Object - Meshes
function initObject() {
    // XMLHttpRequest objects are used to interact with servers
    // It can be used to retrieve any type of data, not just XML.
    var request = new XMLHttpRequest();
    request.open("GET", input_JSON);
    // MIME: Multipurpose Internet Mail Extensions
    // It lets users exchange different kinds of data files
    request.overrideMimeType("application/json");
    request.onreadystatechange = function () {
        //request.readyState == 4 means operation is done
        if (request.readyState == 4) {
            processObject(JSON.parse(request.responseText));
        }
    };
    request.send();
}
function processObject(objData) {
    objVertexPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, objVertexPositionBuffer);
    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(objData.vertexPositions),
        gl.STATIC_DRAW
    );
    objVertexPositionBuffer.itemSize = 3;
    objVertexPositionBuffer.numItems = objData.vertexPositions.length / 3;

    objVertexNormalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, objVertexNormalBuffer);
    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(objData.vertexNormals),
        gl.STATIC_DRAW
    );
    objVertexNormalBuffer.itemSize = 3;
    objVertexNormalBuffer.numItems = objData.vertexNormals.length / 3;

    objVertexTextureBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, objVertexTextureBuffer);
    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(objData.vertexTextureCoords),
        gl.STATIC_DRAW
    );
    objVertexTextureBuffer.itemSize = 2;
    objVertexTextureBuffer.numItems = objData.vertexTextureCoords.length / 2;

    objVertexIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, objVertexIndexBuffer);
    gl.bufferData(
        gl.ELEMENT_ARRAY_BUFFER,
        new Uint32Array(objData.indices),
        gl.STATIC_DRAW
    );
    objVertexIndexBuffer.itemSize = 1;
    objVertexIndexBuffer.numItems = objData.indices.length;

    drawScene();
}
function drawObject(color) {
    if (!objVertexPositionBuffer || !objVertexNormalBuffer || !objVertexIndexBuffer) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, objVertexPositionBuffer);
    gl.vertexAttribPointer(
        aPositionLocation,
        objVertexPositionBuffer.itemSize,
        gl.FLOAT,
        false,
        0,
        0
    );

    gl.bindBuffer(gl.ARRAY_BUFFER, objVertexNormalBuffer);
    gl.vertexAttribPointer(
        aNormalLocation,
        objVertexNormalBuffer.itemSize,
        gl.FLOAT,
        false,
        0,
        0
    );

    gl.bindBuffer(gl.ARRAY_BUFFER, objVertexTextureBuffer);
    gl.vertexAttribPointer(
        aTexCoordLocation,
        objVertexTextureBuffer.itemSize,
        gl.FLOAT,
        false,
        0,
        0
    );

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, objVertexIndexBuffer);

    passAttributes(color);

    gl.drawElements(
        gl.TRIANGLES,
        objVertexIndexBuffer.numItems,
        gl.UNSIGNED_INT,
        0
    );
}

// Draw Spheres
// Sphere initialization function
function initSphere(nslices, nstacks, radius) {
    for (var i = 0; i <= nslices; i++) {
        var angle = (i * Math.PI) / nslices;
        var comp1 = Math.sin(angle);
        var comp2 = Math.cos(angle);

        for (var j = 0; j <= nstacks; j++) {
            var phi = (j * 2 * Math.PI) / nstacks;
            var comp3 = Math.sin(phi);
            var comp4 = Math.cos(phi);

            var xcood = comp4 * comp1;
            var ycoord = comp2;
            var zcoord = comp3 * comp1;
            var utex = 1 - j / nstacks;
            var vtex = 1 - i / nslices;

            spVerts.push(radius * xcood, radius * ycoord, radius * zcoord);
            spNormals.push(xcood, ycoord, zcoord);
            spTexCoords.push(utex, vtex);
        }
    }

    // now compute the indices here
    for (var i = 0; i < nslices; i++) {
        for (var j = 0; j < nstacks; j++) {
            var id1 = i * (nstacks + 1) + j;
            var id2 = id1 + nstacks + 1;

            spIndicies.push(id1, id2, id1 + 1);
            spIndicies.push(id2, id2 + 1, id1 + 1);
        }
    }
}

function initSphereBuffer() {
    var nslices = 50;
    var nstacks = 50;
    var radius = 1;

    initSphere(nslices, nstacks, radius);

    // buffer for vertices
    spBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, spBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(spVerts), gl.STATIC_DRAW);
    spBuf.itemSize = 3;
    spBuf.numItems = spVerts.length / 3;

    // buffer for indices
    spIndexBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, spIndexBuf);
    gl.bufferData(
        gl.ELEMENT_ARRAY_BUFFER,
        new Uint32Array(spIndicies),
        gl.STATIC_DRAW
    );
    spIndexBuf.itemsize = 1;
    spIndexBuf.numItems = spIndicies.length;

    // buffer for normals
    spNormalBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, spNormalBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(spNormals), gl.STATIC_DRAW);
    spNormalBuf.itemSize = 3;
    spNormalBuf.numItems = spNormals.length / 3;

    // buffer for texture coordinates
    spTexBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, spTexBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(spTexCoords), gl.STATIC_DRAW);
    spTexBuf.itemSize = 2;
    spTexBuf.numItems = spTexCoords.length / 2;
}

function drawSphere(color, tex, textureFile, textureUnit = gl.TEXTURE1, number = 1) {
    // bind the vertex buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, spBuf);
    gl.vertexAttribPointer(aPositionLocation, spBuf.itemSize, gl.FLOAT, false, 0, 0);

    // bind the normal buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, spNormalBuf);
    gl.vertexAttribPointer(aNormalLocation, spNormalBuf.itemSize, gl.FLOAT, false, 0, 0);

    // bind the texture buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, spTexBuf);
    gl.vertexAttribPointer(aTexCoordLocation, spTexBuf.itemSize, gl.FLOAT, false, 0, 0);

    // bind the index buffer
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, spIndexBuf);

    passAttributes(color);

    // for texture binding
    // gl.activeTexture(gl.TEXTURE0);
    // gl.bindTexture(gl.TEXTURE_2D, depthTexture);
    // gl.uniform1i(u3DTextureLocation, 0); 


    // draw the sphere
    gl.drawElements(gl.TRIANGLES, spIndexBuf.numItems, gl.UNSIGNED_INT, 0);
}

// Draw Cubes
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
    cubeBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    cubeBuf.itemSize = 3;
    cubeBuf.numItems = vertices.length / 3;

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

    var texCoords = [
        // Front face
        0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0,
        // Back face
        0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0,
        // Top face
        0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0,
        // Bottom face
        0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0,
        // Right face
        0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0,
        // Left face
        0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0,
    ];
    cubeTexBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeTexBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);
    cubeTexBuf.itemSize = 2;
    cubeTexBuf.numItems = texCoords.length / 2;

    var indices = [
        0, 1, 2, 0, 2, 3, // Front face
        4, 5, 6, 4, 6, 7, // Back face
        8, 9, 10, 8, 10, 11, // Top face
        12, 13, 14, 12, 14, 15, // Bottom face
        16, 17, 18, 16, 18, 19, // Right face
        20, 21, 22, 20, 22, 23, // Left face
    ];
    cubeIndexBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeIndexBuf);
    gl.bufferData(
        gl.ELEMENT_ARRAY_BUFFER,
        new Uint16Array(indices),
        gl.STATIC_DRAW
    );
    cubeIndexBuf.itemSize = 1;
    cubeIndexBuf.numItems = indices.length;
}

function drawCube(color) {
    // bind the vertex buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeBuf);
    gl.vertexAttribPointer(aPositionLocation, cubeBuf.itemSize, gl.FLOAT, false, 0, 0);

    // bind the normal buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeNormalBuf);
    gl.vertexAttribPointer(aNormalLocation, cubeNormalBuf.itemSize, gl.FLOAT, false, 0, 0);

    // bind the texture buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeTexBuf);
    gl.vertexAttribPointer(aTexCoordLocation, cubeTexBuf.itemSize, gl.FLOAT, false, 0, 0);

    // bind the index buffer
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeIndexBuf);

    passAttributes(color);

    // gl.activeTexture(gl.TEXTURE0); // set texture unit 1 to use
    // gl.bindTexture(gl.TEXTURE_2D, depthTexture);

    // draw the cube
    gl.drawElements(gl.TRIANGLES, cubeIndexBuf.numItems, gl.UNSIGNED_SHORT, 0);
}
function drawBall() {
    mMatrix = mat4.translate(mMatrix, [0.1, 0.1, 0.2]);
	mMatrix = mat4.scale(mMatrix, [0.1, 0.1, 0.1]);
	color = [0.0, 0.5, 0.75];
	drawSphere(color);
}
function drawPlate(){
    mMatrix = mat4.translate(mMatrix, [-0.05, 0.0, 0.0]);
    mMatrix = mat4.scale(mMatrix, [0.9, 0.01, 1.1]);
	color = [0.4, 0.4, 0.4];
	drawCube(color);
}
function drawTeapot() {
    mMatrix = mat4.translate(mMatrix, [-0.15, 0.15, -0.15]);
	mMatrix = mat4.rotate(mMatrix, degToRad(-90), [0, 1, 0]);
	mMatrix = mat4.scale(mMatrix, [0.05/3, 0.05/3, 0.05/3]);
	color = [0.15, 0.75, 0.5];
	drawObject(color);
}
function drawactualScene() {
    pushMatrix(matrixStack, mMatrix);
    drawBall();
    mMatrix = popMatrix(matrixStack);
    pushMatrix(matrixStack, mMatrix);
    // mMatrix = topMatrix(matrixStack);
    drawPlate();
    mMatrix = popMatrix(matrixStack);
    // mMatrix = topMatrix(matrixStack);
    pushMatrix(matrixStack, mMatrix);
    drawTeapot();
    mMatrix = popMatrix(matrixStack);

}
function drawShadowScene() {
    mat4.identity(mMatrix);
    mat4.identity(vMatrix);
    vMatrix = mat4.lookAt(lightPosition, [0, 0, 0], [0, 1, 0], vMatrix);

    gl.viewport(0, 0, depthTextureSize, depthTextureSize);
    gl.clearColor(0.8, 0.8, 0.8, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    //set up the model matrix
    mat4.identity(mMatrix);
    // updateCamera();
    // degree += 0.35;

	mat4.perspective(45, 1.0, 1, 3, pMatrix);
    //set up projection matrix
    // mat4.perspective(60, 1.0, 0.01, 1000, pMatrix);
    mat4.multiply(pMatrix, vMatrix, lvMatrix);
	// mMatrix = mat4.scale(mMatrix, [2, 2, 2]);
    drawactualScene();

}
function drawRenderScene() {
    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    //set up the model matrix
    mat4.identity(mMatrix);

    // set up the view matrix, multiply into the modelview matrix
    mat4.identity(vMatrix);
    vMatrix = mat4.lookAt(eyePos, [0, 0, 0], [0, 1, 0], vMatrix);

    if (isAnimating) {
        degree += 0.35;
        updateCamera();
    }
    //set up projection matrix
    mat4.identity(pMatrix);
    // mat4.perspective(60, 1.0, 0.01, 1000, pMatrix);
		mat4.perspective(45, 1.0, 0.2, 20, pMatrix);

    // gl.activeTexture(gl.TEXTURE0);
	// 	gl.bindTexture(gl.TEXTURE_2D, depthTexture);
	// 	gl.uniform1i(udepthTextureLocation, 0);
    	// mMatrix = mat4.scale(mMatrix, [2, 2, 2]);

    drawactualScene();
}
function drawScene() {
    // degree = 0.0;
    if (animation) {
        window.cancelAnimationFrame(animation);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, FBO);
    shaderProgram = shadowPassShaderProgram;
    gl.useProgram(shaderProgram);
    setAttributes();
    drawShadowScene();
  
    animate = function () {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        shaderProgram = renderPassShaderProgram;
        gl.useProgram(shaderProgram);
        setAttributes();
        drawRenderScene();
        animation = window.requestAnimationFrame(animate);
     
    }

    animate();
}


// Movement of the objects
function onMouseDown(event) {
    document.addEventListener("mousemove", onMouseMove, false);
    document.addEventListener("mouseup", onMouseUp, false);
    document.addEventListener("mouseout", onMouseOut, false);

    mouseMoved = true;

    if (
        event.layerX <= canvas.width &&
        event.layerX >= 0 &&
        event.layerY <= canvas.height &&
        event.layerY >= 0
    ) {
        isAnimating = false;
        prevMouseX = event.clientX;
        prevMouseY = canvas.height - event.clientY;
    }
}

function onMouseMove(event) {
    // make mouse interaction only within canvas
    if (
        event.layerX <= canvas.width &&
        event.layerX >= 0 &&
        event.layerY <= canvas.height &&
        event.layerY >= 0
    ) {
        var mouseX = event.clientX;
        var diffX = mouseX - prevMouseX;
        zAngle = zAngle + diffX / 5;
        prevMouseX = mouseX;

        var mouseY = canvas.height - event.clientY;
        var diffY = mouseY - prevMouseY;
        yAngle = yAngle - diffY / 5;
        prevMouseY = mouseY;

        drawScene();
    }
}
function webGLStart() {
    canvas = document.getElementById("assgn4");
    // document.addEventListener("mousedown", onMouseDown, false);
    // Access the start animation button by its ID
    // Set event listeners
    document.getElementById('lightSlider').addEventListener('input', (e) => {
        lightPosition[2] = parseFloat(e.target.value);
        drawScene();
    });
    //by default make the checkbox unchecked
    document.getElementById('animateCheckbox').checked = false;
    document.getElementById('animateCheckbox').addEventListener('change', (e) => {
        isAnimating = e.target.checked;
    });

    initGL(canvas);
    shadowPassShaderProgram = initShaders(shadowVertexShaderCode, shadowFragShaderCode);
    renderPassShaderProgram = initShaders(renderVertexShaderCode, renderFragShaderCode);
    gl.enable(gl.DEPTH_TEST);
    setAttributes();


    //initialize buffers for the teapot
    initDepthFBO();
    initSphereBuffer();
    initCubeBuffer();
    initObject();
    drawScene();
}