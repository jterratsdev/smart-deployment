import { expect } from 'chai';
import { describe, it } from 'mocha';
import { XMLParser } from 'fast-xml-parser';
import { buildObjectFlexipageOverlay } from '../../../src/deployment/object-flexipage-overlay.js';

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
    <actionOverrides><actionName>View</actionName><content>Page_A</content><formFactor>Large</formFactor><type>Flexipage</type></actionOverrides>
    <actionOverrides><actionName>View</actionName><content>Page_A</content><formFactor>Small</formFactor><type>Flexipage</type></actionOverrides>
    <actionOverrides><actionName>Edit</actionName><content>Other_Page</content><formFactor>Large</formFactor><type>Flexipage</type></actionOverrides>
    <actionOverrides><actionName>Tab</actionName><type>Default</type></actionOverrides>
    <label>Example</label><fields><fullName>Example__c</fullName><type>Text</type></fields>
</CustomObject>`;

const parse = (value: string): unknown =>
  new XMLParser({ ignoreAttributes: false, trimValues: true, parseTagValue: false }).parse(value);

describe('buildObjectFlexipageOverlay', () => {
  it('removes only selected activation overrides, preserving other metadata and source semantics', () => {
    const overlay = buildObjectFlexipageOverlay(xml, ['Page_A']);
    expect(overlay.pages).to.deep.equal(['Page_A']);
    expect(overlay.foundation).not.to.include('<content>Page_A</content>');
    expect(overlay.foundation).to.include('<content>Other_Page</content>');
    expect(overlay.foundation).to.include('<fullName>Example__c</fullName>');
    expect(parse(overlay.activation)).to.deep.equal(parse(xml));
    expect(buildObjectFlexipageOverlay(overlay.activation, ['Page_A']).foundation).to.equal(overlay.foundation);
  });

  it('rejects missing pages, duplicates, incomplete overrides, and malformed input', () => {
    expect(() => buildObjectFlexipageOverlay(xml, ['Missing'])).to.throw('absent');
    expect(() => buildObjectFlexipageOverlay(xml, ['Page_A', 'Page_A'])).to.throw('Duplicate');
    expect(() => buildObjectFlexipageOverlay(xml.replace('<formFactor>Large</formFactor>', ''), ['Page_A'])).to.throw(
      'Incomplete'
    );
    expect(() => buildObjectFlexipageOverlay('<CustomObject>', ['Page_A'])).to.throw('Invalid');
    expect(() =>
      buildObjectFlexipageOverlay(xml.replace('http://soap.sforce.com/2006/04/metadata', 'urn:other'), ['Page_A'])
    ).to.throw('namespace');
    expect(() =>
      buildObjectFlexipageOverlay(xml.replace('</CustomObject>', '</CustomObject><CustomObject/>'), ['Page_A'])
    ).to.throw('root');
    expect(() =>
      buildObjectFlexipageOverlay(xml.replace('<formFactor>Small</formFactor>', '<formFactor>Large</formFactor>'), [
        'Page_A',
      ])
    ).to.throw('Duplicate Flexipage action override');
  });

  it('preserves namespace attributes and unrelated override assignments', () => {
    const source = xml
      .replace('<CustomObject xmlns=', '<CustomObject custom="kept" xmlns=')
      .replace('<label>Example</label>', '<label>Tour &amp; Visit</label>');
    const overlay = buildObjectFlexipageOverlay(source, ['Page_A']);
    expect(parse(overlay.activation)).to.deep.equal(parse(source));
    expect(overlay.foundation).to.include('custom="kept"');
    expect(overlay.foundation).to.include('<content>Other_Page</content>');
    expect(parse(overlay.foundation)).to.deep.equal(
      parse(
        source.replace(
          /\s*<actionOverrides><actionName>View<\/actionName><content>Page_A<\/content>.*?<\/actionOverrides>/g,
          ''
        )
      )
    );
  });
});
