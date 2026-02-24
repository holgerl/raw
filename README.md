# Raw Canvas

Raw Canvas is an imperative framework for graphics and animations in HTML Canvas. It is minimal, no-build, and bare bones exposing the raw canvas.  

## Usage

```javascript
<script src="./raw.build.js"></script>
<script>
    Raw.init(document.getElementById('myCanvas'));

    (function onFrame() {
        requestAnimationFrame(onFrame);
        Raw.onFrame();
    })();
</script>
```