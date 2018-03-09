import { Logger, Lexer, Parser, Validator, Analyzer, Formatter, Generator } from "./";
export declare class Compiler {
    logger: Logger;
    lexer: Lexer;
    parser: Parser;
    validator: Validator;
    analyzer: Analyzer;
    formatter: Formatter;
    generator: Generator;
    constructor();
    compile(lines: string[], moduleName?: string): ArrayBuffer | null;
}