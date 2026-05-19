#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = resolve(rootDir, 'docs/site-manifest.json');
const outputPath = resolve(rootDir, 'site/src/generated-site-content.ts');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

function readMarkdown(path) {
  return stripFrontmatter(readFileSync(resolve(rootDir, path), 'utf8'));
}

function stripFrontmatter(markdown) {
  return markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
}

function extractSection(markdown, heading) {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => line.replace(/^#+\s*/, '').trim() === heading);

  if (start === -1) {
    throw new Error(`Heading "${heading}" was not found`);
  }

  const level = lines[start].match(/^#+/)?.[0].length ?? 1;
  const end = lines.findIndex(
    (line, index) => index > start && line.startsWith('#'.repeat(level)) && line[level] === ' '
  );

  return lines
    .slice(start + 1, end === -1 ? lines.length : end)
    .join('\n')
    .trim();
}

function cleanMarkdown(value) {
  return value
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstParagraph(markdown) {
  const paragraph = markdown
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .find(
      (block) =>
        block &&
        !block.startsWith('#') &&
        !block.startsWith('```') &&
        !block.startsWith('- ') &&
        !block.startsWith('![') &&
        !block.startsWith('[![')
    );

  return cleanMarkdown(paragraph ?? '');
}

function bulletItems(markdown) {
  const items = [];

  for (const line of markdown.split(/\r?\n/)) {
    if (line.startsWith('- ')) {
      items.push(line.slice(2).trim());
    } else if (items.length > 0 && /^\s{2,}\S/.test(line)) {
      items[items.length - 1] += ` ${line.trim()}`;
    }
  }

  return items.map(cleanMarkdown).filter(Boolean);
}

function commandBody(section) {
  const behavior = section.match(/Behavior:\s*\n\n([\s\S]*)/);
  const bullets = bulletItems(behavior?.[1] ?? section);
  return bullets.slice(0, 2).join('; ') || firstParagraph(section);
}

function buildHero() {
  const markdown = readMarkdown(manifest.hero.source);
  const section = extractSection(markdown, manifest.hero.heading);

  return {
    eyebrow: 'Salesforce CLI Plugin',
    title: 'Dependency-aware deployment orchestration for Salesforce metadata.',
    lead: firstParagraph(section),
    primary: { label: 'View Architecture', href: '/architecture' },
    secondary: { label: 'Read Docs', href: '/docs' },
  };
}

function buildCommands() {
  return manifest.commands.map((command) => {
    const markdown = readMarkdown(command.source);
    const section = extractSection(markdown, command.heading);

    return {
      name: command.title,
      command: command.command,
      body: commandBody(section),
    };
  });
}

function buildDocs() {
  return manifest.docs.map((doc) => {
    const markdown = readMarkdown(doc.source);
    const section = extractSection(markdown, doc.heading);
    const summarySection = doc.summaryHeading ? extractSection(markdown, doc.summaryHeading) : section;

    return {
      title: doc.title,
      slug: doc.slug,
      href: `#${doc.slug}`,
      body: firstParagraph(section),
      items: bulletItems(summarySection).slice(0, 3),
    };
  });
}

function sectionHeadings(markdown) {
  return markdown
    .split(/\r?\n/)
    .map((line) => line.match(/^##\s+(.+)$/)?.[1]?.trim())
    .filter(Boolean);
}

function buildDocPages() {
  return manifest.docs.map((doc) => {
    const markdown = readMarkdown(doc.source);
    const section = extractSection(markdown, doc.heading);
    const headings = sectionHeadings(markdown).filter((heading) => heading !== doc.heading);

    return {
      title: doc.title,
      slug: doc.slug,
      source: doc.source,
      eyebrow: 'Documentation',
      body: firstParagraph(section),
      sections: headings.slice(0, 6).map((heading) => {
        const childSection = extractSection(markdown, heading);

        return {
          title: cleanMarkdown(heading),
          body: firstParagraph(childSection),
          items: bulletItems(childSection).slice(0, 6),
        };
      }),
    };
  });
}

const siteContent = {
  navLinks: manifest.nav,
  hero: buildHero(),
  commands: buildCommands(),
  operatingModel: {
    eyebrow: 'Operating Model',
    title: 'Analyze first, deploy in controlled waves.',
    steps: ['Scan', 'Graph', 'Plan Waves', 'Validate', 'Deploy'],
  },
  architecture: {
    eyebrow: 'Architecture',
    title: 'Layered deployment planning with explicit side-effect boundaries.',
    lead: 'The plugin keeps parsing, analysis, wave planning, AI inference, and Salesforce CLI execution in separate modules so deployment risk is visible before remote changes begin.',
    layers: manifest.architecture.layers,
    diagram: {
      eyebrow: 'System Diagram',
      title: 'Analysis stays separate from deployment execution.',
      body: 'The command layer coordinates local analysis first. Remote Salesforce effects only happen through the execution services after validation and wave planning.',
      nodes: [
        { id: 'cli', label: 'Command Layer', x: 40, y: 90 },
        { id: 'scan', label: 'Metadata Scanners', x: 290, y: 30 },
        { id: 'graph', label: 'Dependency Graph', x: 290, y: 150 },
        { id: 'waves', label: 'Wave Engine', x: 540, y: 90 },
        { id: 'validate', label: 'Validation', x: 790, y: 30 },
        { id: 'execute', label: 'Execution Services', x: 790, y: 150 },
      ],
      edges: [
        ['cli', 'scan'],
        ['cli', 'graph'],
        ['scan', 'waves'],
        ['graph', 'waves'],
        ['waves', 'validate'],
        ['waves', 'execute'],
      ],
    },
    process: {
      eyebrow: 'Deployment Flow',
      title: 'Analyze, validate, execute, then resume if needed.',
      body: 'Each phase has a durable artifact: graph output, deployment waves, validation findings, deployment state, and final reports.',
      artifacts: [
        'metadata scan',
        'dependency graph',
        'wave plan',
        'validation findings',
        'deployment state',
        'release report',
      ],
    },
    risks: manifest.architecture.risks,
    aiBoundary: {
      eyebrow: 'AI Boundary',
      title: 'Optional inference does not replace deterministic analysis.',
      panels: [
        {
          title: 'Deterministic Core',
          body: 'Parsers, graph algorithms, metadata scanners, and validators produce the baseline deployment plan.',
        },
        {
          title: 'Provider Adapters',
          body: 'Agentforce and OpenAI adapters add prioritization and inference behind explicit configuration.',
        },
      ],
    },
  },
  docs: {
    eyebrow: 'Documentation',
    title: 'Operate Smart Deployment from one place.',
    lead: 'The public docs cover the command surface, AI configuration, known limits, and the architecture boundary that keeps analysis separate from deployment side effects.',
    cards: buildDocs(),
    pages: buildDocPages(),
    nextStep: {
      eyebrow: 'Recommended Paths',
      title: 'Follow the workflow you are running.',
      panels: [
        {
          title: 'Operate the CLI',
          body: 'Start with the command reference when you need supported flags, behavior, and command differences.',
          label: 'Open command reference',
          href: '#command-reference',
          internal: true,
        },
        {
          title: 'Prepare a release',
          body: 'Use the release checklist and workflow when validating a candidate or publishing the package.',
          label: 'Open release checklist',
          href: '#release-candidate-checklist',
          internal: true,
        },
      ],
    },
  },
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(
  outputPath,
  `// Generated by scripts/generate-site-content.js from docs/site-manifest.json.\nexport const siteContent = ${JSON.stringify(
    siteContent,
    null,
    2
  )} as const;\n`,
  'utf8'
);
