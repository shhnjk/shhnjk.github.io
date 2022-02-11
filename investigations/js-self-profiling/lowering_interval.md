# Lowering the sampling interval of JS Self-Profiling API

There is a request to [lower the minimal sampling interval of JS Self-Profiling API](https://github.com/WICG/js-self-profiling/issues/68) to 1 millisecond.
As metioned in the [_Limitation of sampleInterval_ section](https://github.com/shhnjk/shhnjk.github.io/blob/main/investigations/js-self-profiling/security_review.md#limitation-of-sampleinterval) of the security review, having minimal sample interval of 10 milliseconds was considered positively for exposing JS Self-Profiling API without COI requirement.

This document will try to evaluate if lowering the sampling interval to 1 millisecond is safe.

## Changes to JS Self-Profiling API from previous security review

After the security review of JS Self-Profiling API, an [issue was raised](https://github.com/WICG/js-self-profiling/issues/51) to stop exposing built-in functions triggered by cross-origin no-cors scripts to profiler, and changes were made in the API to account for the concern raised.
Thereofore, an attack scenario to [get information of cross-origin no-cors scripts](https://github.com/shhnjk/shhnjk.github.io/blob/main/investigations/js-self-profiling/security_review.md#get-information-of-cross-origin-no-cors-scripts) using JS Self-Profiling API does not work anymore (here is the [PoC](https://github.com/shhnjk/shhnjk.github.io/blob/main/investigations/js-self-profiling/PoCs/amplify_with_profiling_v2.html)).

## Risk of lowering the sampling interval

By looking at the [security review](https://github.com/shhnjk/shhnjk.github.io/blob/main/investigations/js-self-profiling/security_review.md), it's clear that the risk of lowering the sampling interval boils down to exposing a high resolution timer, which was considered [out of scope](https://github.com/shhnjk/shhnjk.github.io/blob/main/investigations/js-self-profiling/security_review.md#out-of-scope-for-this-security-review) for previous security review.

Therefore, I've reviewed the [code of Chromium](https://source.chromium.org/chromium) and found out that the high resolution timer exposed by `performance.now()` is [100 microseconds](https://source.chromium.org/chromium/chromium/src/+/main:third_party/blink/renderer/core/timing/time_clamper.h;l=21;drc=62b77bef90de54f0136b51935fa2d5814a1b4da9) without [Cross-Origin Isolation](https://web.dev/cross-origin-isolation-guide/).

As current high resolution timer exposed to non-COI context is 10 times more precise than 1 millisecond which was requested for minimal sampling interval, the risk of JS Self-Profiling API used as a high resolution timer is low.

## Conclusion

Given a [security improvement](#changes-to-js-self-profiling-api-from-previous-security-review) seen in the API, and relatively [low risk](#risk-of-lowering-the-sampling-interval) of the API being used as a high resolution timer (even with the proposed sampling interval), _I incline to agree that lowering the sampling interval of JS Self-Profiling API to 1 millisecond is safe_.
