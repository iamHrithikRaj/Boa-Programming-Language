//Parser
function Parser(program: string) {
  program = skip_whitespace(program);
  let match: RegExpExecArray, expr: object;
  if ((match = /^"([^"]*)"/.exec(program))) {
    expr = { type: "value", value: match[1] };
  } else if ((match = /^\d+\b/.exec(program))) {
    expr = { type: "value", value: Number(match[0]) };
  } else if ((match = /^[^\s(),#"]+/.exec(program))) {
    expr = { type: "word", name: match[0] };
  } else {
    throw new SyntaxError("Unexpected Syntax: " + program);
  }

  return applyParsing(expr, program.slice(match[0].length));
}

function skip_whitespace(string: string) {
  let first: number = string.search(/\S/);
  if (first == -1) return "";
  return string.slice(first);
}

function applyParsing(expr: any, program: string) {
  program = skip_whitespace(program);
  if (program[0] != "(") {
    return { expr: expr, rest: program };
  }
  program = skip_whitespace(program.slice(1));
  expr = { type: "apply", operator: expr, args: [] };
  while (program[0] != ")") {
    let arg = Parser(program);
    expr.args.push(arg.expr);
    program = skip_whitespace(arg.rest);
    if (program[0] == ",") {
      program = skip_whitespace(program.slice(1));
    } else if (program[0] != ")") {
      throw new SyntaxError("Expected ',' or ')' ");
    }
  }
  return applyParsing(expr, program.slice(1));
}

function parse(program: string) {
  let { expr, rest } = Parser(program);
  if (skip_whitespace(rest).length > 0) {
    throw new SyntaxError("Unexpected text after program");
  }
  return expr;
}

// console.log(parse("+(a, 10)"));

//Evaluator
const specialTypes = Object.create(null);

function evaluator(expr: any, scope: any) {
  if (expr.type == "value") {
    return expr.value;
  } else if (expr.type == "word") {
    if (expr.name in scope) {
      return scope[expr.name];
    } else {
      throw new ReferenceError(`Undefined binding: ${expr.name}`);
    }
  } else if (expr.type == "apply") {
    let { operator, args } = expr;
    if (operator.type == "word" && operator.name in specialTypes) {
      return specialTypes[operator.name](expr.args, scope);
    } else {
      let op = evaluator(operator, scope);
      if (typeof op == "function") {
        return op(...args.map((arg: any) => evaluator(arg, scope)));
      } else {
        throw new TypeError("Applying a non-function.");
      }
    }
  }
}

//Special Forms

specialTypes.if = (args: string, scope: string) => {
  if (args.length != 3) {
    throw new SyntaxError("Wrong number of args to 'if'");
  } else if (evaluator(args[0], scope) !== false) {
    return evaluator(args[1], scope);
  } else {
    return evaluator(args[2], scope);
  }
};

specialTypes.while = (args: string, scope: string) => {
  if (args.length != 2) {
    throw new SyntaxError("Wrong number of args to while");
  }
  while (evaluator(args[0], scope) !== false) {
    evaluator(args[1], scope);
  }
  return false;
};

specialTypes.do = (args, scope) => {
  let value = false;
  for (let arg of args) {
    value = evaluator(arg, scope);
  }
  return value;
};

specialTypes.define = (args, scope) => {
  if (args.length != 2 || args[0].type != "word") {
    throw new SyntaxError("Incorrect use of define");
  }
  let value = evaluator(args[1], scope);
  scope[args[0].name] = value;
  return value;
};

const topScope = Object.create(null);

topScope.true = true;
topScope.false = false;

// let prog = parse(`if(true, false, true)`);
// console.log(evaluator(prog, topScope));

for (let op of ["+", "-", "*", "/", "==", "<", ">"]) {
  topScope[op] = Function("a, b", `return a ${op} b;`);
}

topScope.print = (value: any) => {
  console.log(value);
  return value;
};

function run(program: string) {
  return evaluator(parse(program), Object.create(topScope));
}

// run(`
//   do(define(limit, 0),
//     define(count, 1),
//     while(<(count, 11),
//           do(define(limit, +(limit, count)),
//               define(count, +(count, 1)))),
//     print(limit))
// `);

specialTypes.fun = (args: any, scope: any) => {
  if (!args.length) {
    throw new SyntaxError("Function need a body");
  }
  let body = args[args.length - 1];
  let params = args.slice(0, args.length - 1).map((expr: any) => {
    if (expr.type != "word") {
      throw new SyntaxError("Parameters name must be words  ");
    }
    return expr.name;
  });

  return function () {
    if (arguments.length != params.length) {
      throw new TypeError("Wrong number of arguments");
    }
    let localScope = Object.create(scope);
    for (let i = 0; i < arguments.length; i++) {
      localScope[params[i]] = arguments[i];
    }

    return evaluator(body, localScope);
  };
};

run(`
do(define(plusOne, fun(a, +(a, 1))),
   print(plusOne(10)))
`);
// → 11

run(`
do(define(pow, fun(base, exp,
     if(==(exp, 0),
        1,
        *(base, pow(base, -(exp, 1)))))),
   print(pow(2, 10)))
`);
// → 1024
