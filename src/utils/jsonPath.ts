// Minimal JSONPath helper with @random support.
import {randomInt} from 'crypto';

export function getTarget(inputObject: unknown, inputString: string): [object: unknown, chosenPath: string] {
  if (!inputObject) return [null, ''];
  if (inputString.length === 0) return [inputObject, inputString];

  let startDot = inputString.indexOf('.');
  if (startDot === -1) startDot = inputString.length;

  let keyString = inputString.slice(0, startDot);
  const inputStringTail = inputString.slice(startDot + 1);

  const startParentheses = keyString.indexOf('[');

  if (startParentheses === -1) {
    const targetObject = getObjectMember(inputObject, keyString);
    if (!targetObject) return [null, ''];
    const [object, path] = getTarget(targetObject, inputStringTail);
    return [object, inputString.slice(0, inputString.length - inputStringTail.length) + path];
  } else {
    const indexString = keyString.slice(startParentheses + 1, keyString.length - 1);
    keyString = keyString.slice(0, startParentheses);

    const targetObject = getObjectMember(inputObject, keyString);
    if (!targetObject || !Array.isArray(targetObject)) return [null, ''];

    switch (indexString) {
    case '@random': {
      const [chosenElement, chosenNumber] = randomElement(targetObject);
      const [object, path] = getTarget(chosenElement, inputStringTail);
      return [object, inputString
          .slice(0, inputString.length - inputStringTail.length)
          .replace('@random', String(chosenNumber)) + path];
    }
    default: {
      const [object, path] = getTarget(targetObject[parseInt(indexString)], inputStringTail);
      return [object, inputString.slice(0, inputString.length - inputStringTail.length) + path];
    }
    }
  }
}

export function replaceRandomInPath(randomPath: string, resolvedPath: string): string {
  if (!randomPath.includes('@random')) return randomPath;

  let newPath = randomPath;
  while (newPath.includes('@random')) {
    const startRandom = newPath.indexOf('@random');
    if (newPath.substring(0, startRandom) !== resolvedPath.substring(0, startRandom)) break;
    const endParenthesis = resolvedPath.indexOf(']', startRandom);
    newPath = newPath.replace('@random', resolvedPath.substring(startRandom, endParenthesis));
  }

  return newPath;
}

function getObjectMember(inputObject: object, keyString: string): unknown {
  if (keyString === '$') return inputObject;
  for (const [key, value] of Object.entries(inputObject)) {
    if (key === keyString) return value;
  }
  return null;
}

function randomElement<T>(array: Array<T>): [T, number] {
  const randomNumber = randomInt(array.length);
  return [array[randomNumber], randomNumber];
}
