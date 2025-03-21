/////////////////////////////////////////

// Variables
var gl;
var canvas;
var matrixStack = [];

var zAngle = 0.0;
var yAngle = 0.0;

var prevMouseX = 0;
var prevMouseY = 0;
var mouseMoved = false;

var aPositionLocation;
var aNormalLocation;
var aTexCoordLocation;

var uVMatrixLocation;
var uMMatrixLocation;
var uPMatrixLocation;
var uWNMatrixLocation;

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

// For Phong shading
var lightPosition = [-1, 2.5, 4];
var ambientColor = [1, 1, 1];
var diffuseColor = [0.5, 0.5, 0.5];
var specularColor = [1.0, 1.0, 1.0];

var cubeMapTexture;
var u3DTextureLocation;

var vMatrix = mat4.create(); // view matrix
var mMatrix = mat4.create(); // model matrix
var pMatrix = mat4.create(); //projection matrix
var wNMatrix = mat4.create(); // model matrix in world space

var eyePos = [1.5, 1.3, 3.2];
var defaultEyePos = [1.5, 0.8, 3.2];

var uEyePosLocation;
var uLightPositionLocation;

// Inpur JSON model file to load
var input_JSON = "./texture_and_other_files/teapot.json";

// Skybox and Reflection Mapping files to load
var cubeMapPath = "./texture_and_other_files/Field/";
var posx, posy, posz, negx, negy, negz;

var posx_file = cubeMapPath.concat("posx.jpg");
var posy_file = cubeMapPath.concat("posy.jpg");
var posz_file = cubeMapPath.concat("posz.jpg");
var negx_file = cubeMapPath.concat("negx.jpg");
var negy_file = cubeMapPath.concat("negy.jpg");
var negz_file = cubeMapPath.concat("negz.jpg");

// 3D Texture Mapping
var uTexture2DLocation;
var woodTexture;
var cubeTexture;
var earthTexture;
var fenceTexture;

var fence = 0;
// var textureFileCube = "./texture_and_other_files/rcube.png";
var textureFileWood = "./texture_and_other_files/wood_texture.jpg"
var textureFileEarth = "./texture_and_other_files/earthmap.jpg";
var textureFileFence = "./texture_and_other_files/fence_alpha.png";
// Animation - Rotation of Camera
var animate;
var animation;
var isAnimating = false; // Variable to track if the animation is active

// Camera rotation speed
var degree = 0.0;



////////////////////////////////////////////////////////////////////

// For Phong shading, Reflection Mapping, 3D Texture Mapping
const vertexShaderCode = `#version 300 es
in vec3 aPosition;
in vec3 aNormal;
in vec2 aTexCoords;

uniform mat4 uMMatrix;
uniform mat4 uPMatrix;
uniform mat4 uVMatrix;
uniform mat4 uWNMatrix;

out vec3 v_worldPosition;
out vec3 v_worldNormal;

out vec3 vPosEyeSpace;
out vec3 normalEyeSpace;

out vec3 L;
out vec3 V;

uniform vec3 uLightPosition;

out vec2 fragTexCoord;

void main() {
    mat4 projectionModelView = uPMatrix * uVMatrix * uMMatrix;
    gl_Position =  projectionModelView * vec4(aPosition, 1.0);

    v_worldPosition = mat3(uMMatrix) * aPosition;
    v_worldNormal = mat3(uWNMatrix) * aNormal;
    gl_PointSize = 1.0;
    vPosEyeSpace = (uVMatrix * uMMatrix * vec4(aPosition, 1.0)).xyz;

    normalEyeSpace = normalize(mat3(uVMatrix * uMMatrix) * aNormal);
    L = normalize(uLightPosition - vPosEyeSpace);
    V = normalize(-vPosEyeSpace);
    fragTexCoord = aTexCoords;
}`;

const fragShaderCode = `#version 300 es
precision mediump float;

uniform samplerCube cubeMap;

in vec3 v_worldPosition;
in vec3 v_worldNormal;
in vec3 normalEyeSpace;
in vec3 L;
in vec3 V;
in vec3 vPosEyeSpace;
in vec2 fragTexCoord;

uniform vec3 eyePos;


uniform vec3 uAmbientColor;
uniform vec3 objColor;
uniform vec3 uSpecularColor;

uniform sampler2D imageTexture;

uniform float uReflectionFactor;     // Reflection factor
uniform bool uRefract;   // whether to refract light
uniform int ufence; // whether to draw fence
out vec4 fragColor;

void main() {
    // cubemap color calculation
    vec3 eyeToSurfaceDir = normalize(v_worldPosition - eyePos);
    vec3 worldNormal = normalize(v_worldNormal);

    // calculate reflection vector
    vec3 directionReflection = reflect(eyeToSurfaceDir, worldNormal);

    // Calculate refraction vector
    vec3 refractVector = refract(eyeToSurfaceDir, worldNormal, 0.82);

    vec4 cubeMapReflectColor = vec4(0,0,0,0);
    cubeMapReflectColor = uRefract ? texture(cubeMap, refractVector) : texture(cubeMap, directionReflection);
    // Phong Shading
    vec3 reflectionVector = normalize(-reflect(L, normalEyeSpace));

    float diffuse = max(dot(normalEyeSpace, L), 0.0);
    float specular = pow(max(dot(reflectionVector, V), 0.0), 24.0);
    float ambient = 0.15;
    vec3 fColor = uAmbientColor * ambient + objColor * diffuse + uSpecularColor * specular;
    
    // look up texture color
    vec4 textureColor =  texture(imageTexture, fragTexCoord); 
    if (ufence == 1 ){
    if (textureColor.a <= 0.01) {discard;}
    }
    textureColor += vec4(fColor, 1.0);
    vec4 refColor = cubeMapReflectColor+vec4(fColor, 1.0);

    // Blending texture mapping and reflection mapping
    fragColor = textureColor * (1.0 - uReflectionFactor) + refColor * uReflectionFactor;
   
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

function passAttributes(color) {
    gl.uniformMatrix4fv(uMMatrixLocation, false, mMatrix);
    gl.uniformMatrix4fv(uVMatrixLocation, false, vMatrix);
    gl.uniformMatrix4fv(uPMatrixLocation, false, pMatrix);
    wNMatrix = mat4.transpose(mat4.inverse(mMatrix));
    gl.uniformMatrix4fv(uWNMatrixLocation, false, wNMatrix);

    gl.uniform3fv(uEyePosLocation, eyePos);
    gl.uniform3fv(uLightPositionLocation, lightPosition);

    gl.uniform3fv(uAmbientColorLocation, color);
    gl.uniform3fv(uDiffuseColorLocation, color);
    gl.uniform3fv(uSpecularColorLocation, specularColor);
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
    uEyePosLocation = gl.getUniformLocation(shaderProgram, "eyePos");
    uLightPositionLocation = gl.getUniformLocation(shaderProgram, 'uLightPosition');
    uAmbientColorLocation = gl.getUniformLocation(shaderProgram, 'uAmbientColor');
    uDiffuseColorLocation = gl.getUniformLocation(shaderProgram, 'objColor');
    uSpecularColorLocation = gl.getUniformLocation(shaderProgram, 'uSpecularColor');

    reflectionFactorLocation = gl.getUniformLocation(shaderProgram, 'uReflectionFactor');
    refractLocation = gl.getUniformLocation(shaderProgram, 'uRefract');
    fencelocation = gl.getUniformLocation(shaderProgram, 'ufence');
    //enable the attribute arrays
    gl.enableVertexAttribArray(aPositionLocation);
    gl.enableVertexAttribArray(aNormalLocation);
    gl.enableVertexAttribArray(aTexCoordLocation);
}

// Rotating the camera around the room
function updateCamera() {
    // Calculate the new camera position (for rotation around the room)
    const cosTheta = Math.cos(degToRad(degree));
    const sinTheta = Math.sin(degToRad(degree));

    eyePos[0] = defaultEyePos[0] * cosTheta - defaultEyePos[2] * sinTheta;
    eyePos[2] = defaultEyePos[0] * sinTheta + defaultEyePos[2] * cosTheta;

    // Recalculate the view matrix
    mat4.lookAt(eyePos, [0, 0, 0], [0, 1, 0], vMatrix);
}

// Cube Mapping - Reflection Mapping
function initCubeMap() {
    const faceInfos = [
        {
            target: gl.TEXTURE_CUBE_MAP_POSITIVE_X,
            url: posx_file,
        },
        {
            target: gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
            url: negx_file,
        },
        {
            target: gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
            url: posy_file,
        },
        {
            target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
            url: negy_file,
        },
        {
            target: gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
            url: posz_file,
        },
        {
            target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
            url: negz_file,
        },
    ]
    cubeMapTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubeMapTexture);
    let loaded_images = 0;
    faceInfos.forEach((faceInfo) => {
        const { target, url } = faceInfo;

        // Upload the canvas to the cubemap face.
        const level = 0;
        const internalFormat = gl.RGBA;
        const width = 512;
        const height = 512;
        const format = gl.RGBA;
        const type = gl.UNSIGNED_BYTE;

        // setup each face so it's immediately renderable
        gl.texImage2D(target, level, internalFormat, width, height, 0, format, type, null);

        // Asynchronously load an image
        const image = new Image();
        image.src = url;
        image.addEventListener('load', function () {
            // Now that the image has loaded upload it to the texture.
            gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubeMapTexture);
            gl.texImage2D(target, level, internalFormat, format, type, image);
            loaded_images++;
            if (loaded_images == 6) {
                gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
                gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
            }
        });
    });
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
};

// 3D Texture Mapping
function initTextures(textureFile) {
    var tex = gl.createTexture();
    tex.image = new Image();
    tex.image.src = textureFile;
    tex.image.onload = function () {
        handleTextureLoaded(tex, textureFile);
    };
    return tex;
}

function handleTextureLoaded(texture, textureFile) {

    gl.bindTexture(gl.TEXTURE_2D, texture);
    // gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1); // use it to flip Y if needed
    if (textureFile == textureFileFence) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.image);
    }
    else {
        gl.texImage2D(
            gl.TEXTURE_2D, // 2D texture
            0, // mipmap level
            gl.RGB, // internal format
            gl.RGB, // format
            gl.UNSIGNED_BYTE, // type of data
            texture.image // array or <img>
        );
    }
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_MIN_FILTER,
        gl.LINEAR_MIPMAP_LINEAR
    );

    drawScene();
    gl.bindTexture(gl.TEXTURE_2D, null);
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
    gl.uniform1f(reflectionFactorLocation, 1.0);  // Enable reflection mapping

    gl.uniform1i(refractLocation, 0);

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
    var radius = 0.5;

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
    gl.activeTexture(gl.TEXTURE0); 
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubeMapTexture); 
    gl.uniform1i(u3DTextureLocation, 0); 

    if (tex == 1) {
        gl.activeTexture(textureUnit); 
        gl.bindTexture(gl.TEXTURE_2D, textureFile); 
        gl.uniform1i(uTexture2DLocation, number); 
        gl.uniform1f(reflectionFactorLocation, 0.0);  
    }
    else {
        gl.uniform1f(reflectionFactorLocation, 1.0);  
    }
    gl.uniform1i(refractLocation, 0); // Convert boolean to float (1.0 for true, 0.0 for false)

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

function drawCube(color, tex, ref, textureUnit = gl.TEXTURE1, number = 1, textureFile = woodTexture, fence = 0) {
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

    gl.activeTexture(textureUnit); // set texture unit 1 to use
    gl.uniform1i(uTexture2DLocation, number); // pass the texture unit to the shader
    gl.uniform1i(fencelocation, fence);
    if (tex > 0) {
        gl.bindTexture(gl.TEXTURE_2D, textureFile); // bind the texture object to the texture unit
        gl.uniform1f(reflectionFactorLocation, 0.0);  // Disable reflection mapping
    }
    else {
        gl.bindTexture(gl.TEXTURE_2D, null); // bind the texture object to the texture unit
        gl.uniform1f(reflectionFactorLocation, 1.0);  // Enable reflection mapping
    }
    gl.uniform1i(refractLocation, ref); 
    // draw the cube
    gl.drawElements(gl.TRIANGLES, cubeIndexBuf.numItems, gl.UNSIGNED_SHORT, 0);
}

function drawSkybox() {
    // Bind the cube buffer (already defined elsewhere)
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeBuf);
    gl.vertexAttribPointer(aPositionLocation, cubeBuf.itemSize, gl.FLOAT, false, 0, 0);

    // Bind the normal buffer for lighting/shading
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeNormalBuf);
    gl.vertexAttribPointer(aNormalLocation, cubeNormalBuf.itemSize, gl.FLOAT, false, 0, 0);

    // Bind the texture buffer to pass texture coordinates
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeTexBuf);
    gl.vertexAttribPointer(aTexCoordLocation, cubeTexBuf.itemSize, gl.FLOAT, false, 0, 0);

    // Bind the index buffer
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeIndexBuf);

    passAttributes([0, 0, 0]);
    gl.uniform1f(reflectionFactorLocation, 0.0);  // Enable reflection mapping
    // Now bind and assign textures for each face of the cube
    // Front face (POSITIVE_Z)
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, posz);  // Front face texture
    gl.uniform1i(uTexture2DLocation, 1); // Enable reflection mapping
    pushMatrix(matrixStack, mMatrix);

    mMatrix = mat4.translate(mMatrix, [0, 0, 99.5]);
    mMatrix = mat4.rotate(mMatrix, degToRad(180), [1, 0, 0]);
    mMatrix = mat4.scale(mMatrix, [200, 200, 0]);
    passAttributes([0, 0, 0]);
  
    drawCubeFace(0, 6);
    mMatrix = popMatrix(matrixStack);

    // Back face (NEGATIVE_Z)
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, negz);  // Back face texture
    gl.uniform1i(uTexture2DLocation, 2);
    pushMatrix(matrixStack, mMatrix);

    mMatrix = mat4.translate(mMatrix, [0, 0, -99.5]);
    mMatrix = mat4.rotate(mMatrix, degToRad(180), [0, 0, 1]);
    mMatrix = mat4.scale(mMatrix, [200, 200, 0]);
    passAttributes([0, 0, 0]);
    drawCubeFace(6, 6);
    mMatrix = popMatrix(matrixStack);

    // Top face (POSITIVE_Y)
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, posy);  // Top face texture
    gl.uniform1i(uTexture2DLocation, 3);
    pushMatrix(matrixStack, mMatrix);

    mMatrix = mat4.translate(mMatrix, [0, 99.5, 0]);
    mMatrix = mat4.scale(mMatrix, [200, 0, 200]);
    passAttributes([0, 0, 0]);
    drawCubeFace(12, 6);
    mMatrix = popMatrix(matrixStack);

    // Bottom face (NEGATIVE_Y)
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, negy);  // Bottom face texture
    gl.uniform1i(uTexture2DLocation, 4);
    pushMatrix(matrixStack, mMatrix);

    mMatrix = mat4.translate(mMatrix, [0, -99.5, 0]);
    mMatrix = mat4.rotate(mMatrix, degToRad(180), [1, 0, 0]);
    mMatrix = mat4.scale(mMatrix, [200, 0, 200]);
    passAttributes([0, 0, 0]);
    drawCubeFace(18, 6);
    mMatrix = popMatrix(matrixStack);

    // Right face (POSITIVE_X)
    gl.activeTexture(gl.TEXTURE5);
    gl.bindTexture(gl.TEXTURE_2D, posx);  // Right face texture
    gl.uniform1i(uTexture2DLocation, 5);
    pushMatrix(matrixStack, mMatrix);

    mMatrix = mat4.translate(mMatrix, [99.5, 0, 0]);
    mMatrix = mat4.rotate(mMatrix, degToRad(90), [1, 0, 0]);
    mMatrix = mat4.rotate(mMatrix, degToRad(180), [0, 0, 1]);
    mMatrix = mat4.scale(mMatrix, [0, 200, 200]);
    passAttributes([0, 0, 0]);
    drawCubeFace(24, 6);
    mMatrix = popMatrix(matrixStack);

    // Left face (NEGATIVE_X)
    gl.activeTexture(gl.TEXTURE6);
    gl.bindTexture(gl.TEXTURE_2D, negx);  // Left face texture
    gl.uniform1i(uTexture2DLocation, 6);
    pushMatrix(matrixStack, mMatrix);

    mMatrix = mat4.translate(mMatrix, [-99.5, 0, 0]);
    mMatrix = mat4.rotate(mMatrix, degToRad(90), [1, 0, 0]);
    mMatrix = mat4.scale(mMatrix, [0, 200, 200]);
    passAttributes([0, 0, 0]);
    drawCubeFace(30, 6);
    mMatrix = popMatrix(matrixStack);

}

// Helper function to draw a single face of the cube
function drawCubeFace(startIndex, count) {
    gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, startIndex * Uint16Array.BYTES_PER_ELEMENT);
}


function drawTable() {
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.scale(mMatrix, [5.5, 0.4, 4.2]);
    // mMatrix = mat4.translate(mMatrix, [0, 0, 0]);
    color = [0, 0, 0];
    drawSphere(color, 1, woodTexture, gl.TEXTURE7, 7);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [-1.7, -1.75, -1.2]);
    mMatrix = mat4.scale(mMatrix, [0.25, 3.5, 0.25]);
    drawCube(color, 1, 0);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [1.7, -1.75, -1.2]);
    mMatrix = mat4.scale(mMatrix, [0.25, 3.5, 0.25]);
    drawCube(color, 1, 0);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [-1.7, -1.75, 1.2]);
    mMatrix = mat4.scale(mMatrix, [0.25, 3.5, 0.25]);
    drawCube(color, 1, 0);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [1.7, -1.75, 1.2]);
    mMatrix = mat4.scale(mMatrix, [0.25, 3.5, 0.25]);
    drawCube(color, 1, 0);
    mMatrix = popMatrix(matrixStack);
}


function drawSpheres() {
    pushMatrix(matrixStack, mMatrix);
    color = [0, 0, 0];
    mMatrix = mat4.translate(mMatrix, [0.1, 0.41, 1.5]);
    mMatrix = mat4.scale(mMatrix, [0.75, 0.75, 0.75]);
    drawSphere(color, 1, earthTexture, gl.TEXTURE8, 8);
    mMatrix = popMatrix(matrixStack);

    pushMatrix(matrixStack, mMatrix);
    color = [0, 0, 0.3];
    mMatrix = mat4.translate(mMatrix, [1.1, 0.47, 0.7]);
    mMatrix = mat4.scale(mMatrix, [0.4, 0.4, 0.4]);
    drawSphere(color, 0);
    mMatrix = popMatrix(matrixStack);
}

function drawRefractedCube() {
    pushMatrix(matrixStack, mMatrix);
    color = [0, 0, 0];
    mMatrix = mat4.translate(mMatrix, [-1.05, 0.53, 1]);
    mMatrix = mat4.scale(mMatrix, [0.5, 0.9, 0.4]);
    mMatrix = mat4.rotate(mMatrix, degToRad(-5), [0, 1, 0]);
    mMatrix = mat4.scale(mMatrix, [1, 1, 0.2])
    drawCube(color, -1, 1);
    mMatrix = popMatrix(matrixStack);
}
function drawMesh() {
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [1.1, 0.52, 0.7]);
    mMatrix = mat4.scale(mMatrix, [0.6, 0.6, 0.6]);
    drawCube([0.1, 0.1, 0.1], 1, 0, gl.TEXTURE9, 9, fenceTexture, 1);
    mMatrix = popMatrix(matrixStack);

}

function drawTeapot() {
    pushMatrix(matrixStack, mMatrix);
    mMatrix = mat4.translate(mMatrix, [0.0, 0.8, -0.2]);
    mMatrix = mat4.scale(mMatrix, [0.08, 0.08, 0.08]);
    color = [0, 0, 0];
    // specularColor = [0.0, 0.0, 0.0];
    drawObject(color);
    mMatrix = popMatrix(matrixStack);
}

//////////////////////////////////////////////////////////////////////
//The main drawing routine
function drawScene() {
    degree = 0.0;
    if (animation) {
        window.cancelAnimationFrame(animate);
    }
  
    animate = function () {
        gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
        gl.clearColor(0.8, 0.8, 0.8, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        //set up the model matrix
        mat4.identity(mMatrix);

        // set up the view matrix, multiply into the modelview matrix
        mat4.identity(vMatrix);
        vMatrix = mat4.lookAt(eyePos, [0, 0, 0], [0, 1, 0], vMatrix);

        updateCamera();
        degree += 0.35;

        //set up projection matrix
        mat4.identity(pMatrix);
        mat4.perspective(60, 1.0, 0.01, 1000, pMatrix);

        drawSkybox();

        mMatrix = mat4.rotate(mMatrix, degToRad(yAngle), [1, 0, 0]);
        mMatrix = mat4.rotate(mMatrix, degToRad(zAngle), [0, 1, 0]);
        specularColor = [1.0, 1.0, 1.0];
        drawTeapot();
        drawMesh();
        specularColor = [1.0, 1.0, 1.0];
        drawSpheres();
        specularColor = [0.0, 0.0, 0.0];
        drawRefractedCube();
        drawTable();
        if (isAnimating) {
        animation = requestAnimationFrame(animate);}
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

function stopAnimation() {
    isAnimating = !isAnimating;
    drawScene();
}
// This is the entry point from the html
function webGLStart() {
    canvas = document.getElementById("assgn3");
    document.addEventListener("mousedown", onMouseDown, false);
     // Access the start animation button by its ID
     const stopButton = document.getElementById('stopButton');
    stopButton.addEventListener('click', () => {
        isAnimating = false;
    });

     const startAnimationButton = document.getElementById('startAnimationButton');
     startAnimationButton.addEventListener('click', () => { 
         if (!isAnimating) {
             isAnimating = true;
             animate();
         }
         // isAnimating = true;
     });
    initGL(canvas);
    shaderProgram = initShaders(vertexShaderCode, fragShaderCode);

    gl.enable(gl.DEPTH_TEST);
    setAttributes();

    //texture location in shader
    u3DTextureLocation = gl.getUniformLocation(shaderProgram, "cubeMap");
    uTexture2DLocation = gl.getUniformLocation(shaderProgram, "imageTexture")

    //initialize buffers for the teapot
    initSphereBuffer();
    initCubeBuffer();
    initCubeMap();
    posx = initTextures(posx_file);
    posy = initTextures(posy_file);
    posz = initTextures(posz_file);
    negz = initTextures(negz_file);
    negx = initTextures(negx_file);
    negy = initTextures(negy_file);

    woodTexture = initTextures(textureFileWood);
    earthTexture = initTextures(textureFileEarth);
    fenceTexture = initTextures(textureFileFence);
    initObject();
    // drawScene();
}