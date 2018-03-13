"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const log_1 = require("./log");
const ast_1 = require("./ast");
class Validator {
    constructor(logger) {
        this.logger = logger;
        this.ruleMap = {};
    }
    validate(ast) {
        this.validateNode(ast);
    }
    validateNode(node) {
        let rules = this.ruleMap[node.type];
        node.valid = true;
        if (rules) {
            for (let rule of rules)
                rule(node);
        }
        if (node.children) {
            for (let child of node.children)
                this.validateNode(child);
        }
    }
    register(type, rule) {
        if (!this.ruleMap[type])
            this.ruleMap[type] = [];
        this.ruleMap[type].push(rule);
    }
    logError(msg, node) {
        this.logger.log(new log_1.LogMsg(log_1.LogType.Error, "Validator", msg, node.token.row, node.token.column, node.token.value.length));
    }
}
exports.Validator = Validator;
class WAScriptValidator extends Validator {
    constructor(logger) {
        super(logger);
        this.registerChildrenType(ast_1.AstType.Program, [ast_1.AstType.FunctionDef, ast_1.AstType.Global, ast_1.AstType.Comment, ast_1.AstType.StructDef, ast_1.AstType.Map]);
        this.registerChildrenType(ast_1.AstType.Block, [ast_1.AstType.VariableDef, ast_1.AstType.Assignment, ast_1.AstType.FunctionCall, ast_1.AstType.Comment, ast_1.AstType.If, ast_1.AstType.Else, ast_1.AstType.ElseIf, ast_1.AstType.While, ast_1.AstType.Break, ast_1.AstType.Continue, ast_1.AstType.Return, ast_1.AstType.ReturnVoid]);
        this.registerChildCount(ast_1.AstType.Access, 2);
        this.registerChildTypes(ast_1.AstType.Access, [[ast_1.AstType.VariableId, ast_1.AstType.Type], [ast_1.AstType.FunctionId, ast_1.AstType.VariableId, ast_1.AstType.Access]]);
        this.registerChildCount(ast_1.AstType.If, 2);
        this.registerChildTypes(ast_1.AstType.If, [[ast_1.AstType.VariableId, ast_1.AstType.Access, ast_1.AstType.Literal, ast_1.AstType.UnaryOp, ast_1.AstType.BinaryOp, ast_1.AstType.FunctionCall], [ast_1.AstType.Block]]);
        this.registerChildCount(ast_1.AstType.Else, 1);
        this.registerPreviousSiblingType(ast_1.AstType.Else, [ast_1.AstType.If, ast_1.AstType.ElseIf]);
        this.registerChildTypes(ast_1.AstType.Else, [[ast_1.AstType.Block]]);
        this.registerChildCount(ast_1.AstType.ElseIf, 2);
        this.registerPreviousSiblingType(ast_1.AstType.ElseIf, [ast_1.AstType.If, ast_1.AstType.ElseIf]);
        this.registerChildTypes(ast_1.AstType.ElseIf, [[ast_1.AstType.VariableId, ast_1.AstType.Access, ast_1.AstType.Literal, ast_1.AstType.UnaryOp, ast_1.AstType.BinaryOp, ast_1.AstType.FunctionCall], [ast_1.AstType.Block]]);
        this.registerChildCount(ast_1.AstType.While, 2);
        this.registerChildTypes(ast_1.AstType.While, [[ast_1.AstType.VariableId, ast_1.AstType.Access, ast_1.AstType.Literal, ast_1.AstType.UnaryOp, ast_1.AstType.BinaryOp, ast_1.AstType.FunctionCall], [ast_1.AstType.Block]]);
        this.registerChildCount(ast_1.AstType.Break, 0);
        this.registerAncestorType(ast_1.AstType.Break, [ast_1.AstType.While]);
        this.registerChildCount(ast_1.AstType.Continue, 0);
        this.registerAncestorType(ast_1.AstType.Continue, [ast_1.AstType.While]);
        this.registerChildCount(ast_1.AstType.Return, 1);
        this.registerChildTypes(ast_1.AstType.Return, [[ast_1.AstType.VariableId, ast_1.AstType.Access, ast_1.AstType.Literal, ast_1.AstType.UnaryOp, ast_1.AstType.BinaryOp, ast_1.AstType.FunctionCall]]);
        this.registerAncestorType(ast_1.AstType.Return, [ast_1.AstType.FunctionDef]);
        this.registerChildCount(ast_1.AstType.ReturnVoid, 0);
        this.registerAncestorType(ast_1.AstType.ReturnVoid, [ast_1.AstType.FunctionDef]);
        this.registerChildCount(ast_1.AstType.Assignment, 2);
        this.registerChildTypes(ast_1.AstType.Assignment, [[ast_1.AstType.VariableDef, ast_1.AstType.VariableId, ast_1.AstType.Access]]);
        this.registerChildTypes(ast_1.AstType.Global, [[ast_1.AstType.VariableDef], [ast_1.AstType.Literal]]);
        this.registerChildrenType(ast_1.AstType.Global, [ast_1.AstType.Const, ast_1.AstType.Export], 2);
        this.registerChildCount(ast_1.AstType.FunctionCall, 2);
        this.registerChildTypes(ast_1.AstType.FunctionCall, [[ast_1.AstType.FunctionId, ast_1.AstType.Access], [ast_1.AstType.Arguments]]);
        this.registerChildrenType(ast_1.AstType.Arguments, [ast_1.AstType.VariableId, ast_1.AstType.Access, ast_1.AstType.Literal, ast_1.AstType.UnaryOp, ast_1.AstType.BinaryOp, ast_1.AstType.FunctionCall]);
        this.registerChildrenType(ast_1.AstType.Fields, [ast_1.AstType.VariableDef, ast_1.AstType.Comment]);
        this.registerChildTypes(ast_1.AstType.StructDef, [[ast_1.AstType.StructId], [ast_1.AstType.Fields]]);
        this.registerChildrenType(ast_1.AstType.StructDef, [ast_1.AstType.Export], 2);
        this.registerChildTypes(ast_1.AstType.FunctionDef, [[ast_1.AstType.FunctionId], [ast_1.AstType.Parameters], [ast_1.AstType.Block]]);
        this.registerChildrenType(ast_1.AstType.FunctionDef, [ast_1.AstType.Export], 3);
        this.registerChildrenType(ast_1.AstType.Parameters, [ast_1.AstType.VariableDef]);
        this.registerChildCount(ast_1.AstType.VariableDef, 1);
        this.registerChildTypes(ast_1.AstType.VariableDef, [[ast_1.AstType.VariableId]]);
        this.registerAncestorType(ast_1.AstType.VariableDef, [ast_1.AstType.Assignment, ast_1.AstType.Global, ast_1.AstType.Map, ast_1.AstType.Parameters, ast_1.AstType.Fields]);
        this.registerChildCount(ast_1.AstType.UnaryOp, 1);
        this.registerChildrenType(ast_1.AstType.UnaryOp, [ast_1.AstType.VariableId, ast_1.AstType.Access, ast_1.AstType.Type, ast_1.AstType.Literal, ast_1.AstType.UnaryOp, ast_1.AstType.BinaryOp, ast_1.AstType.FunctionCall]);
        this.registerChildCount(ast_1.AstType.BinaryOp, 2);
        this.registerChildrenType(ast_1.AstType.BinaryOp, [ast_1.AstType.VariableId, ast_1.AstType.Access, ast_1.AstType.Type, ast_1.AstType.Literal, ast_1.AstType.UnaryOp, ast_1.AstType.BinaryOp, ast_1.AstType.FunctionCall]);
        this.registerChildCount(ast_1.AstType.StructId, 0);
        this.registerChildCount(ast_1.AstType.VariableId, 0);
        this.registerChildCount(ast_1.AstType.FunctionId, 0);
        this.registerChildTypes(ast_1.AstType.Map, [[ast_1.AstType.VariableDef], [ast_1.AstType.Literal]]);
        this.registerChildCount(ast_1.AstType.Export, 0);
        this.registerChildCount(ast_1.AstType.Const, 0);
        this.registerChildCount(ast_1.AstType.Type, 0);
        this.registerChildCount(ast_1.AstType.Literal, 0);
    }
    registerParentType(type, parentTypes) {
        this.register(type, (n) => {
            if (!n.parent) {
                this.logError("Expected parent of " + ast_1.AstType[type] + " node to be " + parentTypes.map(t => ast_1.AstType[t]).join(" node or ") + " node but node has no parent", n);
                n.valid = false;
            }
            else {
                let validType = false;
                for (let type of parentTypes) {
                    if (n.parent.type == type) {
                        validType = true;
                        break;
                    }
                }
                if (!validType) {
                    this.logError("Expected parent of " + ast_1.AstType[type] + " node to be " + parentTypes.map(t => ast_1.AstType[t]).join(" node or ") + " node but found " + ast_1.AstType[n.parent.type] + " node instead", n.parent);
                    n.valid = false;
                }
            }
        });
    }
    registerAncestorType(type, ancestorTypes) {
        this.register(type, (n) => {
            let p = n.parent;
            while (p) {
                for (let type of ancestorTypes) {
                    if (p.type == type)
                        return;
                }
                p = p.parent;
            }
            this.logError("Expected ancestor of " + ast_1.AstType[type] + " node to be " + ancestorTypes.map(t => ast_1.AstType[t]).join(" node or ") + " node but no suitable node found", n.parent ? n.parent : n);
            n.valid = false;
        });
    }
    registerChildCount(type, count) {
        this.register(type, (n) => {
            if ((!n.children && count > 0) || (n.children && n.children.length != count)) {
                this.logError("Expected " + ast_1.AstType[type] + " node to have " + count + (count == 1 ? " child" : " children") + " but " + ((!n.children || n.children.length == 0) ? "none" : "" + n.children.length) + " found", n);
                n.valid = false;
            }
        });
    }
    formatOrdinal(n) {
        let str = n.toFixed();
        if (str != "11" && str.endsWith('1'))
            return str + "st";
        else if (str != "12" && str.endsWith('2'))
            return str + "nd";
        else if (str != "13" && str.endsWith('3'))
            return str + "rd";
        else
            return str + "th";
    }
    registerChildTypes(type, childTypes, startIndex = 0) {
        this.register(type, (n) => {
            for (let i = startIndex; i < startIndex + childTypes.length; i++) {
                if (!n.children || n.children.length <= i) {
                    this.logError("Expected " + this.formatOrdinal(i + 1) + " child of " + ast_1.AstType[type] + " node to be " + childTypes[i - startIndex].map(t => ast_1.AstType[t]).join(" node or ") + " node but node has no " + this.formatOrdinal(i + 1) + " child", n);
                    n.valid = false;
                }
                else {
                    let validType = false;
                    for (let type of childTypes[i - startIndex]) {
                        if (n.children[i].type == type) {
                            validType = true;
                            break;
                        }
                    }
                    if (!validType) {
                        this.logError("Expected " + this.formatOrdinal(i + 1) + " child of " + ast_1.AstType[type] + " node to be " + childTypes[i - startIndex].map(t => ast_1.AstType[t]).join(" node or ") + " node but found " + ast_1.AstType[n.children[i].type] + " node instead", n.children[i]);
                        n.valid = false;
                    }
                }
            }
        });
    }
    registerChildrenType(type, childrenTypes, startIndex = 0) {
        this.register(type, (n) => {
            if (n.children) {
                for (let i = startIndex; i < n.children.length; i++) {
                    let validType = false;
                    for (let type of childrenTypes) {
                        if (n.children[i].type == type) {
                            validType = true;
                            break;
                        }
                    }
                    if (!validType) {
                        this.logError("Expected child of " + ast_1.AstType[type] + " node to be " + childrenTypes.map(t => ast_1.AstType[t]).join(" node or ") + " node but found " + ast_1.AstType[n.children[i].type] + " node instead", n.children[i]);
                        n.valid = false;
                    }
                }
            }
        });
    }
    registerNextSiblingType(type, siblingTypes) {
        this.register(type, (n) => {
            if (!n.parent) {
                this.logError("Expected next sibling of " + ast_1.AstType[type] + " node to be " + siblingTypes.map(t => ast_1.AstType[t]).join(" node or ") + " node but node has no parent", n);
                n.valid = false;
                return;
            }
            let index = n.parent.children.indexOf(n);
            if (index == n.parent.children.length - 1) {
                this.logError("Expected next sibling of " + ast_1.AstType[type] + " node to be " + siblingTypes.map(t => ast_1.AstType[t]).join(" node or ") + " node but node has no next sibling", n);
                n.valid = false;
            }
            else {
                let sibling = n.parent.children[index + 1];
                let validType = false;
                for (let type of siblingTypes) {
                    if (sibling.type == type) {
                        validType = true;
                        break;
                    }
                }
                if (!validType) {
                    this.logError("Expected next sibling of " + ast_1.AstType[type] + " node to be " + siblingTypes.map(t => ast_1.AstType[t]).join(" node or ") + " node but found " + ast_1.AstType[sibling.type] + " node instead", sibling);
                    n.valid = false;
                }
            }
        });
    }
    registerPreviousSiblingType(type, siblingTypes) {
        this.register(type, (n) => {
            if (!n.parent) {
                this.logError("Expected next sibling of " + ast_1.AstType[type] + " node to be " + siblingTypes.map(t => ast_1.AstType[t]).join(" node or ") + " node but node has no parent", n);
                n.valid = false;
                return;
            }
            let index = n.parent.children.indexOf(n);
            if (index == 0) {
                this.logError("Expected previous sibling of " + ast_1.AstType[type] + " node to be " + siblingTypes.map(t => ast_1.AstType[t]).join(" node or ") + " node but node has no previous sibling", n);
                n.valid = false;
            }
            else {
                let sibling = n.parent.children[index - 1];
                let validType = false;
                for (let type of siblingTypes) {
                    if (sibling.type == type) {
                        validType = true;
                        break;
                    }
                }
                if (!validType) {
                    this.logError("Expected previous sibling of " + ast_1.AstType[type] + " node to be " + siblingTypes.map(t => ast_1.AstType[t]).join(" node or ") + " node but found " + ast_1.AstType[sibling.type] + " node instead", sibling);
                    n.valid = false;
                }
            }
        });
    }
}
exports.WAScriptValidator = WAScriptValidator;