(function (_0x4f8bed, _0x531256) {
    'use strict';
    if ((typeof module === 'object') && (typeof module['exports'] === 'object')) {
        module['exports'] = _0x4f8bed['document'] ? _0x531256(_0x4f8bed, !![]) : function (_0x24c80b) {
            if (!_0x24c80b['document']) {
                throw new Error('Geetest requires a window with a document');
            }
            return _0x531256(_0x24c80b);
        };
    } else {
        _0x531256(_0x4f8bed);
    }
}(typeof window !== 'undefined' ? window : this,
    function (_0x5efdb3, _0x3b5323) {
        'use strict';
        if ((typeof _0x5efdb3 === 'undefined')) {
            throw new Error('Geetest requires browser environment');
        }
        var _0x1cf7fd = _0x5efdb3['document'];
        var _0x4f066c = _0x5efdb3['Math'];
        var _0xaa0a82 = _0x1cf7fd['getElementsByTagName']('head')[0x0];
        function _0x3d8f70(_0xf44882) {
            this['_obj'] = _0xf44882;
        }
        _0x3d8f70['prototype'] = {
            '_each': function (_0x3c3fb9) {
                var _0x1922cd = this['_obj'];
                for (var _0x381537 in _0x1922cd) {
                    if (_0x1922cd['hasOwnProperty'](_0x381537)) {
                        _0x3c3fb9(_0x381537, _0x1922cd[_0x381537]);
                    }
                }
                return this;
            }
        };
        function _0x10bc1c(_0x523118) {
            var _0x87efa4 = this;
            new _0x3d8f70(_0x523118)['_each'](function (_0x5f2b5f, _0x33a5dd) {
                _0x87efa4[_0x5f2b5f] = _0x33a5dd;
            });
        }
        _0x10bc1c['prototype'] = {
            'api_server': 'api.geetest.com',
            'protocol': 'http://',
            'type_path': '/gettype.php',
            'fallback_config': {
                'slide': {
                    'static_servers': ['static.geetest.com', 'dn-staticdown.qbox.me'],
                    'type': 'slide',
                    'slide': '/static/js/geetest.0.0.0.js'
                },
                'fullpage': {
                    'static_servers': ['static.geetest.com', 'dn-staticdown.qbox.me'],
                    'type': 'fullpage',
                    'fullpage': '/static/js/fullpage.0.0.0.js'
                }
            },
            '_get_fallback_config': function () {
                var _0x33fa0c = this;
                if (_0x1430da(_0x33fa0c['type'])) {
                    return _0x33fa0c['fallback_config'][_0x33fa0c['type']];
                } else if (_0x33fa0c['new_captcha']) {
                    return _0x33fa0c['fallback_config']['fullpage'];
                } else {
                    return _0x33fa0c['fallback_config']['slide'];
                }
            },
            '_extend': function (_0x2bbad8) {
                var _0x14dbe7 = this;
                new _0x3d8f70(_0x2bbad8)['_each'](function (_0x1132ea, _0x47b81f) {
                    _0x14dbe7[_0x1132ea] = _0x47b81f;
                });
            }
        };
        var _0x391a0b = function (_0x52c4d2) {
            return (typeof _0x52c4d2 === 'number');
        };
        var _0x1430da = function (_0x14c965) {
            return (typeof _0x14c965 === 'string');
        };
        var _0x38d7a5 = function (_0x3edff5) {
            return (typeof _0x3edff5 === 'boolean');
        };
        var _0x26ad8e = function (_0x4f1db1) {
            return (typeof _0x4f1db1 === 'object') && (_0x4f1db1 !== null);
        };
        var _0x3cc9d1 = function (_0x4d736b) {
            return (typeof _0x4d736b === 'function');
        };
        var _0xa4ffea = {};
        var _0x6cd681 = {};
        var _0x33cfcc = function () {
            return (parseInt((_0x4f066c['random']() + 0x2710)) * new Date()['valueOf']());
        };
        var _0x3052c6 = function (_0x38035d, _0x309a64) {
            var _0x31b498 = _0x1cf7fd['createElement']('script');
            _0x31b498['charset'] = 'UTF-8';
            _0x31b498['async'] = !![];
            _0x31b498['onerror'] = function () {
                _0x309a64(!![]);
            };
            var _0x273d71 = ![];
            _0x31b498['onload'] = _0x31b498['onreadystatechange'] = function () {
                if (!_0x273d71 && (!_0x31b498['readyState'] || ('loaded' === _0x31b498['readyState']) || ('complete' === _0x31b498['readyState']))) {
                    _0x273d71 = !![];
                    setTimeout(
                        function () {
                            _0x309a64(![]);
                        },
                        0x0);
                }
            };
            _0x31b498['src'] = _0x38035d;
            _0xaa0a82['appendChild'](_0x31b498);
        };
        var _0x22346c = function (_0x360bda) {
            return _0x360bda['replace'](/^https?:\/\/|\/$/g, '');
        };
        var _0x43f67e = function (_0x1dfd4d) {
            _0x1dfd4d = _0x1dfd4d['replace'](/\/+/g, '/');
            if ((_0x1dfd4d.indexOf('/') !== 0x0)) {
                _0x1dfd4d = ('/' + _0x1dfd4d);
            }
            return _0x1dfd4d;
        };
        var _0x2a1cab = function (_0x1dd0a1) {
            if (!_0x1dd0a1) {
                return '';
            }
            var _0x1e2d1a = '?';
            new _0x3d8f70(_0x1dd0a1)['_each'](function (_0x29c71c, _0x5cf6c4) {
                if (_0x1430da(_0x5cf6c4) || _0x391a0b(_0x5cf6c4) || _0x38d7a5(_0x5cf6c4)) {
                    _0x1e2d1a = ((((_0x1e2d1a + encodeURIComponent(_0x29c71c)) + '=') + encodeURIComponent(_0x5cf6c4)) + '&');
                }
            });
            if ((_0x1e2d1a === '?')) {
                _0x1e2d1a = '';
            }
            return _0x1e2d1a['replace'](/&$/, '');
        };
        var _0x5cdf62 = function (_0x408b20, _0x754047, _0x286899, _0x52394f) {
            _0x754047 = _0x22346c(_0x754047);
            var _0x54288d = (_0x43f67e(_0x286899) + _0x2a1cab(_0x52394f));
            if (_0x754047) {
                _0x54288d = ((_0x408b20 + _0x754047) + _0x54288d);
            }
            return _0x54288d;
        };
        var _0x4ec139 = function (_0x466e01, _0x484181, _0x56b7c8, _0x30d1d4, _0x310b08) {
            var _0x2dc6d2 = function (_0x50dae1) {
                var _0x2ddd20 = _0x5cdf62(_0x466e01, _0x484181[_0x50dae1], _0x56b7c8, _0x30d1d4);
                _0x3052c6(_0x2ddd20,
                    function (_0xa288a7) {
                        if (_0xa288a7) {
                            if ((_0x50dae1 >= (_0x484181['length'] - 0x1))) {
                                _0x310b08(!![]);
                            } else {
                                _0x2dc6d2((_0x50dae1 + 0x1));
                            }
                        } else {
                            _0x310b08(![]);
                        }
                    });
            };
            _0x2dc6d2(0x0);
        };
        var _0xc288d4 = function (_0x52730e, _0x1a2be6, _0x134fb3, _0x9b16d2) {
            if (_0x26ad8e(_0x134fb3['getLib'])) {
                _0x134fb3['_extend'](_0x134fb3['getLib']);
                _0x9b16d2(_0x134fb3);
                return;
            }
            if (_0x134fb3['offline']) {
                _0x9b16d2(_0x134fb3['_get_fallback_config']());
                return;
            }
            var _0x43790e = ('geetest_' + _0x33cfcc());
            _0x5efdb3[_0x43790e] = function (_0x8b593c) {
                if ((_0x8b593c['status'] === 'success')) {
                    _0x9b16d2(_0x8b593c['data']);
                } else if (!_0x8b593c['status']) {
                    _0x9b16d2(_0x8b593c);
                } else {
                    _0x9b16d2(_0x134fb3['_get_fallback_config']());
                }
                _0x5efdb3[_0x43790e] = undefined;
                try {
                    delete _0x5efdb3[_0x43790e];
                } catch (_0x492cdf) { }
            };
            _0x4ec139(_0x134fb3['protocol'], _0x52730e, _0x1a2be6, {
                'gt': _0x134fb3['gt'],
                'callback': _0x43790e
            },
                function (_0x3de1ee) {
                    if (_0x3de1ee) {
                        _0x9b16d2(_0x134fb3['_get_fallback_config']());
                    }
                });
        };
        var _0x3d3d4f = function (_0x1fd9b0, _0xe44488) {
            var _0x4f4bad = {
                'networkError': '网络错误1'
            };
            if ((typeof _0xe44488['onError'] === 'function')) {
                _0xe44488['onError'](_0x4f4bad[_0x1fd9b0]);
            } else {
                throw new Error(_0x4f4bad[_0x1fd9b0]);
            }
        };
        var _0x158ab7 = function () {
            return !!_0x5efdb3['Geetest'];
        };
        if (_0x158ab7()) {
            _0x6cd681['slide'] = 'loaded';
        }
        var _0x1f4861 = function (_0x20be3d, _0x5ee573) {
            var _0x5defc9 = new _0x10bc1c(_0x20be3d);
            if (_0x20be3d['https']) {
                _0x5defc9['protocol'] = 'https://';
            } else if (!_0x20be3d['protocol']) {
                _0x5defc9['protocol'] = (_0x5efdb3['location']['protocol'] + '//');
            }
            _0xc288d4([_0x5defc9['api_server'] || _0x5defc9['apiserver']], _0x5defc9['type_path'], _0x5defc9,
                function (_0x388d37) {
                    var _0x176839 = _0x388d37['type'];
                    var _0x55a9d0 = function () {
                        _0x5defc9['_extend'](_0x388d37);
                        _0x5ee573(new _0x5efdb3[('Geetest')](_0x5defc9));
                    };
                    _0xa4ffea[_0x176839] = _0xa4ffea[_0x176839] || [];
                    var _0x2f0a5f = _0x6cd681[_0x176839] || 'init';
                    if ((_0x2f0a5f === 'init')) {
                        _0x6cd681[_0x176839] = 'loading';
                        _0xa4ffea[_0x176839]['push'](_0x55a9d0);
                        _0x4ec139(_0x5defc9['protocol'], _0x388d37['static_servers'] || _0x388d37['domains'], _0x388d37[_0x176839] || _0x388d37['path'], null,
                            function (_0x37edc4) {
                                if (_0x37edc4) {
                                    _0x6cd681[_0x176839] = 'fail';
                                    _0x3d3d4f('networkError', _0x5defc9);
                                } else {
                                    _0x6cd681[_0x176839] = 'loaded';
                                    var _0x4f8bca = _0xa4ffea[_0x176839];
                                    for (var _0x366a20 = 0x0,
                                        _0x101c82 = _0x4f8bca['length']; (_0x366a20 < _0x101c82); _0x366a20 = (_0x366a20 + 0x1)) {
                                        var _0x4ab3e6 = _0x4f8bca[_0x366a20];
                                        if (_0x3cc9d1(_0x4ab3e6)) {
                                            _0x4ab3e6();
                                        }
                                    }
                                    _0xa4ffea[_0x176839] = [];
                                }
                            });
                    } else if ((_0x2f0a5f === 'loaded')) {
                        _0x55a9d0();
                    } else if ((_0x2f0a5f === 'fail')) {
                        _0x3d3d4f('networkError', _0x5defc9);
                    } else if ((_0x2f0a5f === 'loading')) {
                        _0xa4ffea[_0x176839]['push'](_0x55a9d0);
                    }
                });
        };
        _0x5efdb3['initGeetest'] = _0x1f4861;
        return _0x1f4861;
    }));
