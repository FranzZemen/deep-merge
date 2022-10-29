import 'mocha';
import * as chai from 'chai';
import {Merger} from '../publish/index.js';

const expect = chai.expect;
const should = chai.should();

describe('deep-merge.test', () => {
  it('should merge a field in two flat generic objects', () => {
    const source = {name: 'foo'};
    const target = {name: 'bar'};

    const _ = new Merger();
    _.merge(target, source);

    (target.name).should.equal('foo');
  });
  it('should add a field in two flat generic objects', () => {
    const source = {name: 'foo'};
    const target = {name: undefined};

    const _ = new Merger();
    _.merge(target, source);

    (target.name).should.equal('foo');
  });
  it('should add fields in nested generic objects', () => {
    const source = {name: 'foo', address: {city: 'bar', street: 'car'}};
    const target = {name: undefined};

    const _ = new Merger();
    _.merge(target, source);

    (target.name).should.equal('foo');
    // @ts-ignore
    (target?.address?.city).should.equal('bar');
  });
  it('should merge and add fields in nested generic objects', () => {
    const source = {name: 'foo', address: {city: 'bar', street: 'car'}};
    const target = {name: undefined, address: {street: 'star'}};

    const _ = new Merger();
    _.merge(target, source);

    (target.name).should.equal('foo');
    // @ts-ignore
    (target?.address?.city).should.equal('bar');
    (target?.address?.street).should.equal('car');
  });

  it('should merge cyclic in source property properly', () => {
    const address = {city: 'bar', street: 'car'};
    address['nextAddress'] = address;
    const source = {name: 'foo', address: address};
    const target = {name: undefined, address: {street: 'star'}};

    const _ = new Merger();
    _.merge(target, source);

    (target.name).should.equal('foo');
    // @ts-ignore
    (target?.address?.city).should.equal('bar');
    (target?.address?.street).should.equal('car');
    // @ts-ignore
    (target?.address?.nextAddress?.street).should.equal('car');
  });
  it('should merge top level primitive array ', () => {
    const source = [1, 'hello', true];
    const target = [];

    const _ = new Merger();
    _.merge(target, source);

    (Array.isArray(target)).should.be.true;
    target.length.should.equal(3);
  });
  it('should merge nested  primitive array ', () => {
    const source = {a:5, b:[1, 'hello', true]};
    const target = {a:4};

    const _ = new Merger();
    _.merge(target, source);

    // @ts-ignore
    (Array.isArray(target.b)).should.be.true;
    // @ts-ignore
    target.b.length.should.equal(3);
  });
})
