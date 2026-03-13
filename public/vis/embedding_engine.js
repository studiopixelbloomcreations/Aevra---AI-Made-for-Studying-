// VIS Embedding Engine (Human.js)
(function () {
  const VIS = (window.VIS = window.VIS || {});
  let human = null;

  async function initHuman() {
    if (human) return human;
    if (window.__visHuman) { human = window.__visHuman; return human; }
    if (!window.Human || !window.Human.Human) throw new Error('Human.js not loaded');
    human = new window.Human.Human({
      backend: 'webgl',
      modelBasePath: 'https://cdn.jsdelivr.net/npm/@vladmandic/human/models/',
      cacheSensitivity: 0,
      face: { enabled: true, detector: { enabled: true }, description: { enabled: true }, emotion: { enabled: true } },
      body: { enabled: false },
      hand: { enabled: false }
    });
    if (human.load) await human.load();
    if (human.warmup) await human.warmup();
    window.__visHuman = human;
    return human;
  }

  VIS.embeddingEngine = {
    async init() { return initHuman(); },
    async embed(video) {
      const h = await initHuman();
      if (h.tf && h.tf.engine && h.tf.engine().startScope) h.tf.engine().startScope();
      const res = await h.detect(video);
      const face = res && res.face && res.face[0];
      const embedding = face && face.embedding ? face.embedding.slice(0) : [];
      const emotion = face && face.emotion ? face.emotion : [];
      if (h.tf && h.tf.engine && h.tf.engine().endScope) h.tf.engine().endScope();
      if (h.tf && h.tf.nextFrame) await h.tf.nextFrame();
      return { embedding, emotion, face };
    }
  };
})();
