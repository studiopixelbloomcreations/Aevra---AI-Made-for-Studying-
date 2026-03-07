(function () {
  const canvas = document.getElementById("canvas");
  const img = document.getElementById("sourceImage");
  const shaderEl = document.getElementById("fragShader");
  if (!canvas || !img || !shaderEl) return;

  const gl = canvas.getContext("webgl", { antialias: true, alpha: false });
  if (!gl) return;

  const setCanvasSize = function () {
    canvas.width = Math.max(1, window.innerWidth);
    canvas.height = Math.max(1, window.innerHeight);
  };
  setCanvasSize();

  const vsSource = ""
    + "attribute vec2 position;\n"
    + "void main() {\n"
    + "  gl_Position = vec4(position, 0.0, 1.0);\n"
    + "}\n";
  const fsSource = shaderEl.textContent || "";

  const createShader = function (type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error("Shader error:", gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  };

  const vs = createShader(gl.VERTEX_SHADER, vsSource);
  const fs = createShader(gl.FRAGMENT_SHADER, fsSource);
  if (!vs || !fs) return;

  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("Program link error:", gl.getProgramInfoLog(program));
    return;
  }
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW
  );

  const position = gl.getAttribLocation(program, "position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const uniforms = {
    resolution: gl.getUniformLocation(program, "iResolution"),
    time: gl.getUniformLocation(program, "iTime"),
    mouse: gl.getUniformLocation(program, "iMouse"),
    texture: gl.getUniformLocation(program, "iChannel0"),
  };

  let mouse = [0, 0];
  window.addEventListener("mousemove", function (e) {
    mouse = [e.clientX, canvas.height - e.clientY];
  });
  window.addEventListener("touchmove", function (e) {
    const t = e && e.touches && e.touches[0] ? e.touches[0] : null;
    if (!t) return;
    mouse = [t.clientX, canvas.height - t.clientY];
  }, { passive: true });

  const texture = gl.createTexture();
  const uploadTexture = function () {
    try {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    } catch (err) {
      console.error("Texture upload failed:", err);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        1,
        1,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        new Uint8Array([10, 10, 10, 255])
      );
    }
  };

  if (img.complete) {
    uploadTexture();
  } else {
    img.onload = uploadTexture;
    img.onerror = uploadTexture;
  }

  const startTime = performance.now();
  const render = function () {
    const currentTime = (performance.now() - startTime) / 1000;

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.uniform3f(uniforms.resolution, canvas.width, canvas.height, 1.0);
    gl.uniform1f(uniforms.time, currentTime);
    gl.uniform4f(uniforms.mouse, mouse[0], mouse[1], 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(uniforms.texture, 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(render);
  };

  window.addEventListener("resize", setCanvasSize);
  render();
})();
