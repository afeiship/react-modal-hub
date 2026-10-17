# react-modal-hub
> One hub to present, dismiss, and sync every React modal.

[![version][version-image]][version-url]
[![license][license-image]][license-url]
[![download][download-image]][download-url]

## installation
```shell
npm install -S @jswork/react-modal-hub
```

## usage
  ```js
  import ReactModalHub from '@jswork/react-modal-hub';
  import '@jswork/react-modal-hub/dist/style.scss';

  function App() {
    return (
      <div className="m-10 p-4 shadow bg-gray-100 text-gray-800 hover:shadow-md transition-all">
        <div className="badge badge-warning absolute right-0 top-0 m-4">
          Build Time: {BUILD_TIME}
        </div>
        <ReactModalHub className="debug-red">
          abc
        </ReactModalHub>
      </div>
    );
  }

  export default App;
  ```

## preview
- https://afeiship.github.io/react-modal-hub/

## license
Code released under [the MIT license](https://github.com/afeiship/react-modal-hub/blob/master/LICENSE.txt).

[version-image]: https://img.shields.io/npm/v/@jswork/react-modal-hub
[version-url]: https://npmjs.org/package/@jswork/react-modal-hub

[license-image]: https://img.shields.io/npm/l/@jswork/react-modal-hub
[license-url]: https://github.com/afeiship/react-modal-hub/blob/master/LICENSE.txt

[download-image]: https://img.shields.io/npm/dm/@jswork/react-modal-hub
[download-url]: https://www.npmjs.com/package/@jswork/react-modal-hub
