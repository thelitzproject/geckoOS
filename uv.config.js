/*global Ultraviolet*/
// This file is imported by UV's internal worker machinery via self.__uv$config.config.
// The primary config is set inline in sw.js; this file must define the same values.
const _bare =
  (self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1')
    ? 'http://localhost:8080/bare/'
    : '/bare/';

self.__uv$config = {
  prefix:    '/service/uv/',
  bare:      _bare,
  encodeUrl: Ultraviolet.codec.xor.encode,
  decodeUrl: Ultraviolet.codec.xor.decode,
  handler:   '/vendor/aboutproxy/static/uv/uv.handler.js',
  bundle:    '/vendor/aboutproxy/static/uv/uv.bundle.js',
  config:    '/uv.config.js',
  sw:        '/vendor/aboutproxy/static/uv/uv.sw.js',
};
