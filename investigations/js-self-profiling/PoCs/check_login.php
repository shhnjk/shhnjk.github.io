<?php
header("Document-Policy: js-profiling=?1");
?>

<body>
  <script src="https://js-self-profile.glitch.me/login.js"></script>
  <script>
    async function profile(){
      const profiler = await performance.profile({ sampleInterval: 0 });
      await asyncCheckLogin();
      const trace = await profiler.stop();
      let loggedin = false;
      trace.frames.forEach(frame => {
        if(frame.name == 'setItem') {
          loggedin = true;
        }
      });

      if (loggedin) {
        alert('Logged in!!!');
      } else {
        alert('Not logged in :(');
      }
    }

    profile();
  </script>
</body>
