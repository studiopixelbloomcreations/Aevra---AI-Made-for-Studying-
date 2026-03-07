(function () {
  function initOrbParallax() {
    var orbs = document.querySelectorAll('.app-orb');
    if (!orbs.length) return;
    var centerX = window.innerWidth / 2;
    var centerY = window.innerHeight / 2;

    window.addEventListener('pointermove', function (ev) {
      var dx = ev.clientX - centerX;
      var dy = ev.clientY - centerY;
      orbs.forEach(function (orb, idx) {
        var factor = (idx + 1) * 0.014;
        var tx = dx * factor;
        var ty = dy * factor;
        orb.style.transform = 'translate(' + tx.toFixed(2) + 'px,' + ty.toFixed(2) + 'px)';
      });
    });

    window.addEventListener('resize', function () {
      centerX = window.innerWidth / 2;
      centerY = window.innerHeight / 2;
    });
  }

  function initParticles() {
    var canvas = document.getElementById('appParticleField');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    var dpr = Math.max(1, window.devicePixelRatio || 1);
    var width = 0;
    var height = 0;
    var particles = [];
    var particleCount = 84;
    var mouse = { x: -9999, y: -9999, active: false };

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      particles = [];
      for (var i = 0; i < particleCount; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          r: 1 + Math.random() * 2
        });
      }
    }

    function draw() {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = 'rgba(142, 226, 255, 0.52)';
      ctx.strokeStyle = 'rgba(142, 226, 255, 0.14)';

      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        if (mouse.active) {
          var dx = p.x - mouse.x;
          var dy = p.y - mouse.y;
          var distSq = dx * dx + dy * dy;
          var radius = 120;
          if (distSq < radius * radius && distSq > 0.01) {
            var dist = Math.sqrt(distSq);
            var force = (radius - dist) / radius;
            p.vx += (dx / dist) * force * 0.2;
            p.vy += (dy / dist) * force * 0.2;
          }
        }

        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.986;
        p.vy *= 0.986;

        if (p.x < -16) p.x = width + 16;
        if (p.x > width + 16) p.x = -16;
        if (p.y < -16) p.y = height + 16;
        if (p.y > height + 16) p.y = -16;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      for (var a = 0; a < particles.length; a++) {
        for (var b = a + 1; b < particles.length; b++) {
          var pa = particles[a];
          var pb = particles[b];
          var lx = pa.x - pb.x;
          var ly = pa.y - pb.y;
          var d2 = lx * lx + ly * ly;
          if (d2 < 92 * 92) {
            var alpha = 1 - (Math.sqrt(d2) / 92);
            ctx.globalAlpha = alpha * 0.5;
            ctx.beginPath();
            ctx.moveTo(pa.x, pa.y);
            ctx.lineTo(pb.x, pb.y);
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
        }
      }

      window.requestAnimationFrame(draw);
    }

    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', function (ev) {
      mouse.active = true;
      mouse.x = ev.clientX;
      mouse.y = ev.clientY;
    });
    window.addEventListener('pointerleave', function () {
      mouse.active = false;
      mouse.x = -9999;
      mouse.y = -9999;
    });

    resize();
    draw();
  }

  document.addEventListener('DOMContentLoaded', function () {
    initParticles();
    initOrbParallax();
  });
})();
