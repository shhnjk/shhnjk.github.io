# Security Review of JS Self-Profiling

From [the spec's abstract](https://wicg.github.io/js-self-profiling/#abstract):

> This specification describes an API that allows web applications to control a sampling profiler for measuring client JavaScript execution times.

At the time of writing, the API requires [Cross-Origin Isolation](https://html.spec.whatwg.org/#cross-origin-isolation-mode) (COI). Reasoning behind this is [mentioned in the spec](https://wicg.github.io/js-self-profiling/#privacy-security) as follows.

> Lastly, timing attacks remain a concern for any API introducing a new source of high-resolution time information. The spec aims to mitigate this by requiring pages to be cross-origin isolated, providing UAs with a mechanism to process-isolate pages that perform profiling.

However, [folks have pointed out](https://github.com/WICG/js-self-profiling/issues/41) that JS Self-Profiling API does not expose new high-resolution time information. This is because the precision of timing information provided by JS Self-Profiling API is same as `performance.now()`. 

This is covered in the following [portion of the spec](https://wicg.github.io/js-self-profiling/#the-profilersample-dictionary):

> The timestamp attribute MUST be the current high resolution time relative to the profiling session's time origin when the sample was recorded.

However, there might be other new capability exposed by this API, that may warrant the requirement of COI. 

This document will discribe:

1. Capabilities exposed by this API.
2. Whether it's new and unique.
3. Mitigations provided for new capabilities.

And finally conclude if COI is required for this API.

## Review Environment

The security review is performed against [patched](https://github.com/shhnjk/shhnjk.github.io/blob/main/investigations/js-self-profiling/COI.patch) version of Chromium where I have removed COI requirement.

Similar result can be observed by launching Chrome with `--disable-web-security`. However, this is not recommended as the flag also removes a lot of security restrictions which will make this review meaningless.

I've used a Windows machine with Intel Core i9 CPU (3.30GHz) + 64GB RAM to test the implementation.

## Out of Scope for this Security Review

While I've removed the COI requirement in the review environment, current Chromium implementation of the API might still assume to be on the COI context. So, it's not ideal to test if the implementation has the same timer precision as `performance.now()`. Therefore, Chromium implementation review of timer precision is out of scope. 

However, I believe that Chromium implementation at the time of writing can't provide more precise timer than `performance.now()`. See [Limitation of _sampleInterval_](#limitation-of-sampleinterval) for more details on this.

## How to use JS Self-Profiling API

The API allows developers to take a sample profiling of JS execution.

```
function callAlert() {
    alert(1);
}

async function profile(){
    const profiler = await performance.profile({ sampleInterval: 0 });
    callAlert();
    const trace = await profiler.stop();
    console.log(trace);
}

profile();
```

which will return output like the following:

```
{
  "frames": [
    {
      "name": "profile"
    },
    {
      "name": "",
      "column": 1,
      "line": 1,
      "resourceId": 0
    },
    {
      "name": "alert"
    },
    {
      "name": "callAlert",
      "column": 19,
      "line": 1,
      "resourceId": 0
    },
    {
      "name": "stop"
    }
  ],
  "resources": [
    "https://js.example/profile.js"
  ],
  "samples": [
    {
      "stackId": 1,
      "timestamp": 147.18499994277954
    },
    {
      "stackId": 3,
      "timestamp": 163.5349998474121
    },
    {
      "stackId": 4,
      "timestamp": 177.98499989509583
    }
  ],
  "stacks": [
    {
      "frameId": 1
    },
    {
      "frameId": 0,
      "parentId": 0
    },
    {
      "frameId": 3
    },
    {
      "frameId": 2,
      "parentId": 2
    },
    {
      "frameId": 4
    }
  ]
}
```

In short, the API allows developer to set _sampleInterval_, which will be used as a profiling sample interval, and then any function executed from `performance.profile` to `profiler.stop` will be logged in the trace, as long as the function is executed longer than the _sampleInterval_ speficied.

## Limitation of _sampleInterval_

While spec mentions that `sampleInterval` can be any number that's greater than or equal to 0, actual sample interval that will be used in the API is based on lowest interval supported by the User Agent. 

From [the spec](https://wicg.github.io/js-self-profiling/#profile-method):

> The associated sample interval is set to either ProfilerInitOptions.sampleInterval OR the next lowest interval supported by the UA.

The lowest interval supported in Chromium (at the time of writing) is [16 milliseconds](https://source.chromium.org/chromium/chromium/src/+/main:base/time/time.h;l=700;drc=820892f6ee7d4405cebda668fbddfdaa18bbaaf9) for Windows and [10 milliseconds](https://source.chromium.org/chromium/chromium/src/+/main:third_party/blink/renderer/core/timing/profiler_group.cc;l=40;drc=820892f6ee7d4405cebda668fbddfdaa18bbaaf9) for other platforms.
 
Therefore, the lowest sampling interval currently available is 10 milliseconds. Thus, a function has to execute for at least 10 milliseconds or more to be reliably sampled by this API (at the time of writing).

## Mitigations in the API except COI

The API requires all functions included in the trace to be defined in same-origin resources or reources served via CORS.

From [the spec](https://wicg.github.io/js-self-profiling/#privacy-security):

> Including stack frames from functions defined in a cross-origin resource must be performed with caution. The contents of opaque cross-origin scripts should remain inaccessible to UAs, as the resource has not consented to inspection (even with CORP). The spec limits this by requiring all functions included in a trace to be defined in a same-origin resource, or served via CORS.

It's important to note here that while functions defined in no-cors scripts won't show up in a trace, built-in functions (e.g. alert, fetch, etc) called from no-cors scripts will still show up in a trace. However, there will be no information of script (i.e. `resourceId`, `line`, or `column`) specified in this case.

## Possible Scenarios for Abuse

We can think of several scenarios to abuse this API.

### Get information of cross-origin no-cors scripts

As mentioned in above section, an attacker can gain knowledge of built-in functions called from cross-origin no-cors scripts.
But due to the [limitation of _sampleInterval_](#limitation-of-sampleinterval), this requires a function in a cross-origin script to execute more than 10 milliseconds (or 16 milliseconds on Windows).

I've created a [PoC](https://github.com/shhnjk/shhnjk.github.io/blob/main/investigations/js-self-profiling/PoCs/check_login_with_profiling.html) for this, and it requires (for example) a cross-origin function to continuously set local storage[1] for 1000 times to reliably detect which branch the cross-origin function took.

However, there is a slightly better way to detect a built-in function call using JS Self-Profiling API.
If a cross-origin function takes an average of 0.3 milliseconds to execute (this is equivalent of setting local storage 10 times), calling that function about 100 times in a loop from attacker's script will amplify the target function execution. Which will make the target function to appear in the sampleInterval. Therefore, it becomes reliable to detect if a cross-origin function took specific path or not. [This PoC](https://github.com/shhnjk/shhnjk.github.io/blob/main/investigations/js-self-profiling/PoCs/amplify_with_profiling.html) shows the concept in action.

Even though above findings looks interesting, an attacker can modify a native function to easily accomplish the same goal without any requirement on timing of cross-origin scripts. Here is the [PoC](https://github.com/shhnjk/shhnjk.github.io/blob/main/investigations/js-self-profiling/PoCs/check_login_with_overwrite.html) of modifying fetch function.

While above PoC modifies fetch function to get result directly from the network, the technique of overwriting function can be used to do any other things, such as measuring when the function was called by storing a value of `performance.now()`, and so on. Which basically provides similar capability as JS Self-Profiling API.

### Get callstack and execution timing information of same-origin or CORS scripts

Since we can get execution information of same-origin or CORS scripts, that might allows us to get execution information of cross-origin scripts which are loaded with CORS.

However, CORS allows reading the contents of a cross-origin script. Therefore, we can add any excution information we want by modifying the cross-origin script's functions before executing. 
[This PoC](https://github.com/shhnjk/shhnjk.github.io/blob/main/investigations/js-self-profiling/PoCs/function_info_overwrite.html) modified CORS scripts on the fly to capture callstack in the end as well as execution start time for each function. While this is a minimal PoC, there are more detailed information that can be added, such as adding `new Error().stack` to get callstack of a specific function with line and column number.

As JS Self-Profiling API was designed from [Facebook's polyfill](https://github.com/WICG/js-self-profiling#facebooks-profiler-polyfill), it's known that onces all scripts are same-origin or allowed by CORS, capabilities of this API can by replicated (with performance overhead).

## Conclusion

Due to [a mitigation](#mitigations-in-the-api-except-coi) the API provides and [a limitation](#limitation-of-sampleinterval) it has, the capabilities that JS Self-Profiling API provides are not new and unique for attackers. Since all of existing attack scenarios require an attacker to understand the structure of cross-origin scripts, there are much better alternatives available in the Web Platform and I believe that JS Self-Profiling API doesn't expose new risk, even if we remove the COI requirment.

*Therefore, I incline to agree that COI shouldn't be required for JS Self-Profiling API.*


**Notes:**

[1] Writing to local storage is always executed synchronously. Therefore, it blocks the execution of next instruction until writing to storage is completed. Thus, it's ideal for making a function slower :)
