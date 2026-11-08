export function createFakeAudio() {
  const target = new EventTarget();
  return Object.assign(target, {
    src: '',
    currentTime: 0,
    duration: 30,
    loop: false,
    paused: true,
    playCalls: 0,
    pauseCalls: 0,
    play() {
      this.playCalls += 1;
      this.paused = false;
      this.dispatchEvent(new Event('play'));
      return Promise.resolve();
    },
    pause() {
      this.pauseCalls += 1;
      this.paused = true;
      this.dispatchEvent(new Event('pause'));
    },
    load() {},
    removeAttribute(name) {
      if (name === 'src') this.src = '';
    },
  });
}
