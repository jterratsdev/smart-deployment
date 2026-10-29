import { XMLBuilder, XMLParser, XMLValidator } from 'fast-xml-parser';

type XmlNode = Record<string, unknown>;

export type ObjectFlexipageOverlay = {
  foundation: string;
  activation: string;
  pages: string[];
};

const parserOptions = { preserveOrder: true, ignoreAttributes: false, trimValues: false };

function withoutIndentation(nodes: XmlNode[]): XmlNode[] {
  const hasElements = nodes.some((node) => Object.keys(node).some((key) => key !== '#text' && key !== ':@'));
  return nodes
    .filter((node) => !hasElements || typeof node['#text'] !== 'string' || node['#text'].trim() !== '')
    .map((node) =>
      Object.fromEntries(
        Object.entries(node).map(([key, value]) => [
          key,
          Array.isArray(value) ? withoutIndentation(value as XmlNode[]) : value,
        ])
      )
    );
}

export function buildObjectFlexipageOverlay(source: string, pages: readonly string[]): ObjectFlexipageOverlay {
  if (XMLValidator.validate(source) !== true) throw new Error('Invalid CustomObject XML');
  if (pages.length === 0 || pages.some((page) => !page.trim() || page !== page.trim())) {
    throw new Error('At least one exact FlexiPage identity is required');
  }
  const selected = new Set(pages);
  if (selected.size !== pages.length) throw new Error('Duplicate FlexiPage identity');

  const document = withoutIndentation(new XMLParser(parserOptions).parse(source) as XmlNode[]);
  const roots = document.filter((node) => Array.isArray(node.CustomObject));
  if (
    roots.length !== 1 ||
    document.some((node) => Object.keys(node).some((key) => key !== 'CustomObject' && key !== '?xml' && key !== ':@'))
  ) {
    throw new Error('Expected exactly one CustomObject root');
  }
  const root = roots[0];
  if ((root[':@'] as XmlNode | undefined)?.['@_xmlns'] !== 'http://soap.sforce.com/2006/04/metadata') {
    throw new Error('Unexpected CustomObject namespace');
  }
  const children = root.CustomObject as XmlNode[];
  const found = new Set<string>();
  const selectedActions = new Set<string>();
  const foundationChildren = children.filter((node) => {
    if (!Array.isArray(node.actionOverrides)) return true;
    const fields = node.actionOverrides as XmlNode[];
    const value = (name: string): string | undefined => {
      const elements = fields.filter((field) => Array.isArray(field[name]));
      if (elements.length !== 1) return undefined;
      const text = (elements[0][name] as XmlNode[]).find((field) => typeof field['#text'] === 'string');
      return text?.['#text'] as string | undefined;
    };
    const page = value('content');
    if (value('type') !== 'Flexipage' || !page || !selected.has(page)) return true;
    const action = value('actionName');
    const formFactor = value('formFactor');
    if (!action || !formFactor) throw new Error(`Incomplete Flexipage override for ${page}`);
    const actionKey = `${action}:${formFactor}`;
    if (selectedActions.has(actionKey)) throw new Error(`Duplicate Flexipage action override: ${actionKey}`);
    selectedActions.add(actionKey);
    found.add(page);
    return false;
  });
  if (found.size !== selected.size) throw new Error('Selected FlexiPage override is absent from CustomObject');

  const builder = new XMLBuilder({ ...parserOptions, format: true, indentBy: '    ' });
  const foundation = builder.build(
    document.map((node) => (node === root ? { ...root, CustomObject: foundationChildren } : node))
  );
  const activation = source;
  if (XMLValidator.validate(foundation) !== true || XMLValidator.validate(activation) !== true) {
    throw new Error('Generated CustomObject overlay is invalid');
  }
  return { foundation, activation, pages: [...selected].sort() };
}
