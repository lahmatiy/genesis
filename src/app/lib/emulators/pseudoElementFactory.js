var List = require('csso:utils/list.js');
var walk = require('utils.walker').rules;
var translate = require('csso:utils/translate.js');
var pseudoContentFactory = require('./contentFactory');
var nthFactory = require('./nthFactory');

module.exports = function pseudoElementFactory(type, before) {
  var TYPE_NAME = 'pseudo-element-' + type + '__' + basis.genUID();

  return {
    /**@cut*/__debugName: TYPE_NAME,
    getStates: function() {
      return false;
    },
    handleToken: function(token, parent, root, sourceMap, mapper) {
      if (token.type == 'PseudoElement' && token.name == type) {
        var sourceToken = sourceMap.get(token);
        var newToken = List.createItem({type: 'Identifier', name: TYPE_NAME});
        var oldTokenElement;

        token.type = 'Combinator';
        token.name = '>';

        sourceMap.delete(token);
        sourceMap.set(newToken.data, sourceToken);

        oldTokenElement = mapper.bySelector(token);

        if (oldTokenElement) {
          mapper.linkElements(newToken.data, oldTokenElement);
        }

        parent.data.sequence.insert(newToken);
      }
    },
    emulate: function(token, parent, root, sourceMap, mapper, value) {
      var sourceToken = sourceMap.get(token);

      //console.log(token, '=>', sourceToken)
      if (sourceToken && sourceToken.type == 'PseudoElement' && sourceToken.name == type) {
        //debugger;
        var elementHandler;
        var mappedElements = mapper.bySelector(token);
        //console.log(token, mappedElements)
        var allowToEmulate = mappedElements && mappedElements.filter(function(element) {
            var list = new List(parent.data.sequence.toArray().slice(0, -2));

            return element.matches(translate({type: 'SimpleSelector', sequence: list}));
          });

        if (!allowToEmulate || !allowToEmulate.length) {
          return;
        }

        walk(root, {
          Ruleset: function(token) {
            token.selector.selectors.each(function(selector) {
              if (selector == parent.data) {
                token.block.declarations.each(function(declaration) {
                  if (declaration.property.name == 'content' || declaration.property.name == '--dp-disabled-content') {
                    elementHandler = pseudoContentFactory(declaration);

                    if (declaration.property.name == 'content') {
                      declaration.property.name = '--dp-disabled-content';
                    }
                  }
                });
              }
            });
          }
        });

        mapper.removeSelector(token);
        allowToEmulate.forEach(function(element) {
          var existingEmulator = basis.array.from(element.children).filter(function(child) {
            return child.tagName.toLowerCase() == TYPE_NAME.toLowerCase();
          })[0];

          if (existingEmulator) {
            if (elementHandler) {
              existingEmulator.innerHTML = '';
              elementHandler(existingEmulator);
            }
          } else {
            var emulator = document.createElement(TYPE_NAME);

            if (elementHandler) {
              element.insertBefore(emulator, before ? element.firstChild : null);
              elementHandler(emulator);
              mapper.linkElements(parent.data.sequence.last(), emulator);
            }

            basis.array.from(element.children).forEach(function(child) {
              var selectors = mapper.byElement(child);

              if (selectors) {
                selectors.forEach(function(token) {
                  var handleNth = nthFactory(token, child, sourceMap);

                  if (handleNth) {
                    //console.log(selectors);
                    handleNth.change(before ? 1 : -1);
                    handleNth.apply();
                  }
                });
              }
            });
          }
        });
      }
    }
  }
};