# babel-plugin-function-expressions


A Babel plugin that lets you call functions as binary expressions


## Usage

Install it:

```
npm install --save-dev babel-plugin-function-expressions
```

Add it to `.babelrc`:

```js
{
    "plugins": [ "function-expressions" ]
}
```

How to use:

```js
import {filter, sortBy} from 'lodash'

const data = [{x: 1, y: 2}, {x: 2, y: 1}, {x: 1, y: 1}]

const res = data @filter {x: 1} @sortBy 'y'

// res === [{x: 1, y: 1}, {x: 1, y: 2}]
```
