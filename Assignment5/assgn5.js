/////////////////////////////////////////

// Variables
var gl;
var canvas;

var aPositionLocation;

var aLightLocation;
var aMode;

// Buffer for sphere
var squareBuffer;

var light = [-0.6, 5.0, 5.0];
var shadingMode = 4;

const vertexShaderCode = `#version 300 es
in vec3 aPosition;

void main() {
    // calcuie clip space center
    gl_Position =  vec4(aPosition,1.0);
}`;

const fragShaderCode = `#version 300 es
precision mediump float;

uniform vec3 uLightPosition;
uniform int uMode;

out vec4 fragColor;

struct Sphere {
    vec3 center;
    float radius;
    vec3 color;
};
const float alpha = 20.0;
const int numSpheres = 7;
Sphere spheres[numSpheres];
void InitializeSpheres(){
    spheres[0] = Sphere(vec3(0.0, 0.0, -0.2), 0.2, vec3(0.737, 0.149, 0.89));
    spheres[1] = Sphere(vec3(-0.15,0.2, 0.0), 0.19, vec3(0.431, 0.188, 0.749));
    spheres[2] = Sphere(vec3(0.05,0.33, 0.2), 0.15, vec3(0, 0.318, 1));
    spheres[3] = Sphere(vec3(0.22,0.24,0.4), 0.12, vec3(0.098, 0.435, 0.82));
    spheres[4] = Sphere(vec3(0.3,0.04,0.47), 0.10, vec3(0.086, 0.737, 0.859));
    spheres[5] = Sphere(vec3(0.22,-0.13,0.5), 0.10, vec3(0.086, 0.859, 0.529));
    spheres[6] = Sphere(vec3(0.05,-0.15,0.56), 0.10, vec3(0.086, 0.859, 0.184));
}
// Function to calculate the intersection of a ray with a sphere
float intersectRaySphere(vec3 start, vec3 direction, int sphereIndex) {
    vec3 d = start - spheres[sphereIndex].center;
    float a = dot(direction, direction);
    float b = 2.0 * dot(d, direction);
    float c = dot(d, d) - spheres[sphereIndex].radius * spheres[sphereIndex].radius;
    float discriminant = b*b - 4.0*a*c;
    return (discriminant < 0.0) ? 0.0 : (-b - sqrt(discriminant)) / (2.0*a);
}
// Phong shading function
vec3 phongShading(vec3 normal, vec3 lightDir, vec3 viewDir, int sphereIndex) {
    vec3 color = spheres[sphereIndex].color;
    float ambfrac = 0.25;
    float specularfrac = 1.0;
    
    float diff = max(dot(normal, lightDir), 0.0);
    vec3 diffuseColor = diff * color;
    vec3 ambientColor = ambfrac * color;


    vec3 reflectDir = reflect(-lightDir, normal);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), alpha);
    vec3 specularColor = specularfrac * spec * vec3(1.0);

    return ambientColor + diffuseColor + specularColor;
}

// Function to check if a point is in shadow
bool checkShadow(vec3 point, vec3 lightDir, int currentSphere) {
    for (int i = 0; i < numSpheres; i++) {
        if (i == currentSphere) continue;
        float t = intersectRaySphere(point, lightDir, i);
        if (t > 0.0) {
            return true; 
        }
    }
    return false; 
}

void main() {
    vec2 frag_norm = gl_FragCoord.xy / vec2(600.0, 600.0);

    // Camera properties
    vec3 cameraPos = vec3(0.0, 0.0, 1.0);
    vec3 cameraDir = normalize(vec3(frag_norm * 2.0 - 1.0, -1));
    //initialize ray with the camera direction and position
    vec3 rayDirection = cameraDir;
    vec3 rayOrigin = cameraPos;
    
    // Light properties
    vec3 lightColor = vec3(1.0, 1.0, 1.0);

    InitializeSpheres();
    vec3 color = vec3(0.0);
    float amt_in_shadow = 1.0;

    for (int j = 0; j <= 1; j++) {
       if (j == 1 && uMode < 3) break;
        float closestHitDist = 1e6; // Initialize closestHitDist to a value that indicates no intersection
        int HitSphereIndex = -1;
        // Find the closest sphere that the ray intersects
        for (int i = 0; i < numSpheres; i++) {
            float t = intersectRaySphere(rayOrigin, rayDirection, i);
            if (t > 0.0  && t < closestHitDist) {
                closestHitDist = t;
                HitSphereIndex = i;
            }
        }

        if (HitSphereIndex == -1) {
            break;  // No intersection found 
        }
        // Calculate intersection point
        vec3 intersectionPoint = rayOrigin + closestHitDist * rayDirection;
            
        // Calculate normal at the intersection point
        vec3 normal = normalize(intersectionPoint - spheres[HitSphereIndex].center);

        vec3 lightDir = normalize(uLightPosition - intersectionPoint);
        vec3 viewDir = normalize(cameraPos - intersectionPoint);
        
        vec3 reflectionDir = reflect(rayDirection, normal);
        color += phongShading(normal, lightDir, viewDir, HitSphereIndex);
        if (uMode%2 == 0) {
            if (checkShadow(intersectionPoint, lightDir, HitSphereIndex) && j == 0) {
                amt_in_shadow = 3.0;
            }
        }
        rayOrigin = intersectionPoint + 0.001 * normal;
        rayDirection = reflectionDir;
    }
    
    fragColor = vec4(color/amt_in_shadow, 1.0);

}` ;

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

    // check for compiiion and linking status
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

function initSquareBuffer() {
    squareBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, squareBuffer);
    var vertices = [
        -1.0, -1.0, 1.0, -1.0,-1.0, 1.0,1.0, 1.0
    ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

}

// Draw a Quad
function drawSquare() {
    gl.bindBuffer(gl.ARRAY_BUFFER, squareBuffer);
    gl.vertexAttribPointer(aPositionLocation, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.uniform3fv(aLightLocation, light);
    gl.uniform1i(aMode, shadingMode);
}

//The main drawing routine
function drawScene() {
    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    gl.clearColor(1.0, 1.0, 1.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    color = [1.0, 0.0, 0.0];
    drawSquare(color);
}
function getAttributes() {
    aPositionLocation = gl.getAttribLocation(shaderProgram, "aPosition");
    aLightLocation = gl.getUniformLocation(shaderProgram, "uLightPosition");
    aMode = gl.getUniformLocation(shaderProgram, "uMode");
    gl.enableVertexAttribArray(aPositionLocation);
}
function webGLStart() {
    canvas = document.getElementById("ray-tracer");
    initGL(canvas);
    shaderProgram = initShaders();
    getAttributes();
    initSquareBuffer();
    drawScene();
    drawScene();
}

function updateProcessing() {
    const selectedValue = document.querySelector('input[name="processing"]:checked').value;
    switch (selectedValue) {
        case 'processing1':
            shadingMode = 1;
            break;
        case 'processing2':
            shadingMode = 2;
            break;
        case 'processing3':
            shadingMode = 3;
            break;
        case 'processing4':
            shadingMode = 4;
            break;
    }
    drawScene();
    drawScene();
}
function moveLight(value) {
    console.log("here");
    document.getElementById('light-slider').innerHTML = value;
    light[0] = value;
    drawScene();
    drawScene();
}
