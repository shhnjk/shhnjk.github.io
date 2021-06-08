<?php
header("Document-Policy: js-profiling=?1");
?>

<body>
  <!-- https://glitch.com/edit/#!/js-self-profile?path=public%2Flogin.js -->
  <script src="https://js-self-profile.glitch.me/login.js"></script>
  <script>
    function checkLogin(trace) {
      let loggedin = false;
      trace.frames.forEach(frame => {
        if(frame.name == "setItem") {
          loggedin = true;
        }
      });

      if (loggedin) {
        alert('Logged in!!!');
      } else {
        alert('Not logged in :(');
      }
    }
    
    async function profile(){
      const profiler = await performance.profile({ sampleInterval: 0 });
      await asyncCheckLogin();
      const trace = await profiler.stop();
      let loggedin = false;
      checkLogin(trace);
    }

    profile();
  </script>
</body>
