/**
 * Unit tests for GSL Shell (parser + builtins)
 */
import { Parser } from '../../gsl/shell/parser.js';

describe('Shell Parser', () => {
  const parser = new Parser();

  test('simple command', () => {
    const cmds = parser.parse('echo hello');
    expect(cmds).toHaveLength(1);
    expect(cmds[0].name).toBe('echo');
    expect(cmds[0].args).toEqual(['hello']);
  });

  test('pipe', () => {
    const cmds = parser.parse('ls | grep txt');
    expect(cmds).toHaveLength(2);
    expect(cmds[0].name).toBe('ls');
    expect(cmds[1].name).toBe('grep');
    expect(cmds[1].args).toEqual(['txt']);
  });

  test('stdout redirect', () => {
    const cmds = parser.parse('echo hello > /tmp/out.txt');
    expect(cmds[0].stdout_redirect).toBe('/tmp/out.txt');
  });

  test('stdout append redirect', () => {
    const cmds = parser.parse('echo world >> /tmp/out.txt');
    expect(cmds[0].stdout_redirect).toBe('/tmp/out.txt');
    expect(cmds[0].stdout_redirect_append).toBe(true);
  });

  test('quoted arguments', () => {
    const cmds = parser.parse('echo "hello world"');
    expect(cmds[0].args).toEqual(['hello world']);
  });

  test('single-quoted arguments', () => {
    const cmds = parser.parse("echo 'hello world'");
    expect(cmds[0].args).toEqual(['hello world']);
  });
});
