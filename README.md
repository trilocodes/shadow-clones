# 🌀 Shadow Clones

> A real-time hand gesture experience inspired by Naruto — perform ninja signs with your webcam to summon and retract shadow clones.

---

## ✨ Demo

![Shadow Clones Demo](./assets/demo.png)

---

## 🎮 How It Works

| Gesture | Action |
|---|---|
| 🤝 Ninja sign (fingers interlocked) | Activate clone jutsu |
| 🖐️ Open palm (all fingers visible) | Spawn shadow clones |
| ✊ Close fist | Retract clones |

---

## 🚀 Getting Started

### Prerequisites

- A modern browser with webcam support
- Webcam / camera access

### Run Locally

```bash
git clone https://github.com/YOUR_USERNAME/shadow-clones.git
cd shadow-clones
# open index.html in your browser
```

Or visit the live demo:
**[YOUR_USERNAME.github.io/shadow-clones](https://YOUR_USERNAME.github.io/shadow-clones)**

---

## 🛠️ Tech Stack

- **Hand tracking** — MediaPipe / TensorFlow.js Handpose
- **Pose / body detection** — MediaPipe Pose
- **Rendering** — HTML5 Canvas / WebGL
- **Webcam** — Web APIs (`getUserMedia`)
- **Deployment** — GitHub Pages

---

## 📁 Project Structure

```
shadow-clones/
├── index.html        # Entry point
├── style.css         # Styling
├── main.js           # Core logic & gesture detection
├── clones.js         # Clone spawn/retract animations
└── assets/           # Images & demo screenshots
```

---

## 🔮 Features

- 🖐️ Real-time hand landmark detection
- 👤 Body/pose tracking overlay
- 🌀 Dynamic clone spawning with visual effects
- 🔴 Atmospheric red-light visual environment
- ⚡ Runs entirely in the browser — no backend needed

---

## 🤝 Contributing

Pull requests are welcome! For major changes, open an issue first.

---

## 📜 License

[MIT](./LICENSE)

---

<p align="center">Made with 🍥 and way too much chakra</p>
