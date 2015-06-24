'use strict';
/* globals: describe, it */

var expect = require('chai').expect;
var pointer = require('../../lib/pointer');

/** @name describe @function */
/** @name it @function */
/** @name before @function */
/** @name after @function */
/** @name beforeEach @function */
/** @name afterEach @function */

describe('Pointer', function() {

  beforeEach(function() {
    this.target = {
      a: {
        b: {
          c: 1
        }
      },
      d: 2,
      e: {
        f: [3, 4],
        g: [{
          h: true
        }, {
          i: false
        }, 5]
      },
      'j/': 6,
      'k~': 7
    };
  });

  describe('#errors', function() {
    it('should throw if resolving a token that is only a hyphen when in the context of an array', function() {
      expect(function() {
        return pointer.get(this.target, '/e/f/-');
      }.bind(this)).to.throw(SyntaxError);
    });

    it('should throw an error if the pointer is referencing a non-numeric index in the context of an array', function() {
      expect(function() {
        return pointer.get(this.target, '/e/f/nope');
      }.bind(this)).to.throw(ReferenceError);
    });

    it('should throw an error if the pointer is using leading zeros in an array context', function() {
      expect(function() {
        return pointer.get(this.target, '/e/f/00');
      }.bind(this)).to.throw(ReferenceError);
    });

    it('should throw an error if the pointer is not a string', function() {
      expect(function() {
        return pointer.get(this.target, true);
      }.bind(this), 'boolean').to.throw(ReferenceError);

      expect(function() {
        return pointer.get(this.target, {d: 2});
      }.bind(this), 'object').to.throw(ReferenceError);

      expect(function() {
        return pointer.get(this.target, 0);
      }.bind(this), 'number').to.throw(ReferenceError);
    });

    it('should throw an error if the target is not an object', function() {
      expect(function() {
        return pointer.get(function() {
          return {a: 1}
        }, '/a');
      }.bind(this), 'function').to.throw(ReferenceError);

      expect(function() {
        return pointer.get(undefined, '/a');
      }.bind(this), 'undefined').to.throw(ReferenceError);

      expect(function() {
        return pointer.get(true, '/a');
      }.bind(this), 'boolean').to.throw(ReferenceError);

      expect(function() {
        return pointer.get(1, '/0');
      }.bind(this), 'number').to.throw(ReferenceError);

      expect(function() {
        return pointer.get([1], '/0');
      }.bind(this), 'array').to.throw(ReferenceError);
    });
  });

  describe('#resolving', function() {
    it('should return undefined if the reference is not found', function() {
      expect(pointer.get(this.target, '/not/a/reference')).to.be.undefined;
    });

    it('should return an evaluator function when no pointer is provided', function() {
      expect(pointer.get(this.target), 'no pointer').to.be.a('function');
      expect(pointer.get(this.target)('/not/a/reference'), 'bad reference').to.be.undefined;
      expect(pointer.get(this.target)('/a'), '/a reference').to.be.an('object');
    });

    it('should return a resolved object reference', function() {
      expect(pointer.get(this.target, '/a/b')).to.eql({c: 1});
      expect(pointer.get(this.target, '/d')).to.equal(2);
      expect(pointer.get(this.target, '/e/f')).to.eql([3, 4]);
    });

    it('should return a resolved array reference', function() {
      expect(pointer.get(this.target, '/e/f/0'), 'index 0').to.equal(3);
      expect(pointer.get(this.target, '/e/f/1'), 'index 1').to.equal(4);
    });

    it('should return resolved object references within arrays', function() {
      expect(pointer.get(this.target, '/e/g/0/h'), '0 - h').to.be.true;
      expect(pointer.get(this.target, '/e/g/0/i'), '0 - i').to.be.undefined;
      expect(pointer.get(this.target, '/e/g/1/h'), '1 - h').to.be.undefined;
      expect(pointer.get(this.target, '/e/g/1/i'), '1 - i').to.be.false;
    });

    it('should unescape special character sequences in the pointer before resolving', function() {
      expect(pointer.get(this.target, '/j~1'), 'forward slash escape').to.equal(6);
      expect(pointer.get(this.target, '/k~0'), 'tilda escape').to.equal(7);
    });
  });
});
