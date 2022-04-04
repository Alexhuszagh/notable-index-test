To test the differences in performance, run on a Linux system:

```bash
$ time node index.js 
real    0m0.428s
user    0m0.695s
sys     0m0.056s

$ time node index.js 
real    0m0.075s
user    0m0.072s
sys     0m0.008s

$ time node no_index.js 
real    0m0.456s
user    0m0.703s
sys     0m0.068s
```

The second run of `index.js` is to ensure the performance after the index has been written.
