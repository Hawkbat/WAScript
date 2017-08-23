import { LogType, LogMsg, Logger } from "./log"
import { TokenType } from "./token"
import { AstNode, AstType } from "./ast"
import { DataType } from "./datatype"
import { Scope, Function, Variable } from "./scope"

function formatOrdinal(n: number): string {
	let str = n.toFixed()
	if (str != "11" && str.endsWith('1')) return str + "st"
	else if (str != "12" && str.endsWith('2')) return str + "nd"
	else if (str != "13" && str.endsWith('3')) return str + "rd"
	else return str + "th"
}

type ScopeRule = (n: AstNode, p: Scope) => Scope
type DataTypeRule = (n: AstNode) => DataType
type AnalyzeRule = (n: AstNode) => void

class Analyzer {
	private scopeRuleMap: { [key: number]: ScopeRule[] } = {}
	private dataTypeRuleMap: { [key: number]: DataTypeRule[] } = {}
	private analysisRuleMap: { [key: number]: AnalyzeRule[] } = {}
	protected rootScope: Scope

	constructor(protected logger: Logger, protected ast: AstNode) {
		this.rootScope = new Scope(null, null, '')
	}

	public analyze() {
		this.scopePass(this.ast)
		this.typePass(this.ast)
		this.analysisPass(this.ast)
	}

	protected scopePass(node: AstNode) {
		node.scope = this.getScope(node)
		for (let child of node.children) {
			this.scopePass(child)
		}
	}

	protected getScope(node: AstNode): Scope {
		if (node.scope) return node.scope
		let parentScope = (node.parent) ? this.getScope(node.parent) : this.rootScope

		let rules = this.scopeRuleMap[node.type]
		if (rules) {
			for (let rule of rules) node.scope = rule(node, parentScope)
		}

		if (!node.scope) node.scope = parentScope
		return node.scope
	}

	protected typePass(node: AstNode) {
		node.dataType = this.getDataType(node)
		for (let child of node.children) {
			this.typePass(child)
		}
	}

	protected getDataType(node: AstNode): DataType {
		if (!node.valid) node.dataType = DataType.Invalid
		if (node.dataType) return node.dataType

		let rules = this.dataTypeRuleMap[node.type]
		if (rules) {
			for (let rule of rules) node.dataType = rule(node)
		}

		if (!node.dataType) node.dataType = DataType.None
		return node.dataType
	}

	protected analysisPass(node: AstNode) {
		let rules = this.analysisRuleMap[node.type]
		if (rules) {
			for (let rule of rules) rule(node)
		}
		for (let child of node.children) {
			this.analysisPass(child)
		}
	}

	protected registerScope(type: AstType, rule: ScopeRule) {
		if (!this.scopeRuleMap[type]) this.scopeRuleMap[type] = []
		this.scopeRuleMap[type].push(rule)
	}

	protected registerDataType(type: AstType, rule: DataTypeRule) {
		if (!this.dataTypeRuleMap[type]) this.dataTypeRuleMap[type] = []
		this.dataTypeRuleMap[type].push(rule)
	}

	protected registerAnalysis(type: AstType, rule: AnalyzeRule) {
		if (!this.analysisRuleMap[type]) this.analysisRuleMap[type] = []
		this.analysisRuleMap[type].push(rule)
	}

	protected logError(msg: string, node: AstNode) {
		this.logger.log(new LogMsg(LogType.Error, "Analyzer", msg, node.token.row, node.token.column, node.token.value.length))
	}
}

export class WAScriptAnalyzer extends Analyzer {
	constructor(logger: Logger, ast: AstNode) {
		super(logger, ast)
		this.rootScope.funcs["nop"] = new Function(null, this.rootScope, "nop", DataType.None, [])
		this.rootScope.scopes["float"] = new Scope(null, this.rootScope, 'float')
		this.rootScope.scopes["float"].funcs["abs"] = new Function(null, this.rootScope.scopes["float"], "abs", DataType.Float, [DataType.Float])
		this.rootScope.scopes["float"].funcs["ceil"] = new Function(null, this.rootScope.scopes["float"], "ceil", DataType.Float, [DataType.Float])
		this.rootScope.scopes["float"].funcs["floor"] = new Function(null, this.rootScope.scopes["float"], "floor", DataType.Float, [DataType.Float])
		this.rootScope.scopes["float"].funcs["truncate"] = new Function(null, this.rootScope.scopes["float"], "truncate", DataType.Float, [DataType.Float])
		this.rootScope.scopes["float"].funcs["round"] = new Function(null, this.rootScope.scopes["float"], "round", DataType.Float, [DataType.Float])
		this.rootScope.scopes["float"].funcs["sqrt"] = new Function(null, this.rootScope.scopes["float"], "sqrt", DataType.Float, [DataType.Float])
		this.rootScope.scopes["float"].funcs["copysign"] = new Function(null, this.rootScope.scopes["float"], "copysign", DataType.Float, [DataType.Float, DataType.Float])
		this.rootScope.scopes["float"].funcs["min"] = new Function(null, this.rootScope.scopes["float"], "min", DataType.Float, [DataType.Float, DataType.Float])
		this.rootScope.scopes["float"].funcs["max"] = new Function(null, this.rootScope.scopes["float"], "max", DataType.Float, [DataType.Float, DataType.Float])

		this.rootScope.scopes["double"] = new Scope(null, this.rootScope, 'double')
		this.rootScope.scopes["double"].funcs["abs"] = new Function(null, this.rootScope.scopes["double"], "abs", DataType.Double, [DataType.Double])
		this.rootScope.scopes["double"].funcs["ceil"] = new Function(null, this.rootScope.scopes["double"], "ceil", DataType.Double, [DataType.Double])
		this.rootScope.scopes["double"].funcs["floor"] = new Function(null, this.rootScope.scopes["double"], "floor", DataType.Double, [DataType.Double])
		this.rootScope.scopes["double"].funcs["truncate"] = new Function(null, this.rootScope.scopes["double"], "truncate", DataType.Double, [DataType.Double])
		this.rootScope.scopes["double"].funcs["round"] = new Function(null, this.rootScope.scopes["double"], "round", DataType.Double, [DataType.Double])
		this.rootScope.scopes["double"].funcs["sqrt"] = new Function(null, this.rootScope.scopes["double"], "sqrt", DataType.Double, [DataType.Double])
		this.rootScope.scopes["double"].funcs["copysign"] = new Function(null, this.rootScope.scopes["double"], "copysign", DataType.Double, [DataType.Double, DataType.Double])
		this.rootScope.scopes["double"].funcs["min"] = new Function(null, this.rootScope.scopes["double"], "min", DataType.Double, [DataType.Double, DataType.Double])
		this.rootScope.scopes["double"].funcs["max"] = new Function(null, this.rootScope.scopes["double"], "max", DataType.Double, [DataType.Double, DataType.Double])

		this.registerScope(AstType.Program, (n, p) => new Scope(n, p, ""))
		this.registerScope(AstType.Block, (n, p) => new Scope(n, p, ""))
		this.registerScope(AstType.FunctionDef, (n, p) => {
			let scope = new Scope(n, p, n.children[0].token.value)
			let params: DataType[] = []
			for (let i = 0; i < n.children[1].children.length; i++) {
				params.push(DataType.fromString(n.children[1].children[i].token.value))
			}
			let func = new Function(n, scope, n.children[0].token.value, DataType.fromString(n.token.value), params)
			if (p.funcs[func.id]) {
				this.logError("A function with the name " + JSON.stringify(func.id) + " already exists in the current scope", n)
			} else {
				p.funcs[func.id] = func
			}
			return scope
		})
		this.registerScope(AstType.VariableDef, (n, p) => {
			let nvar = new Variable(n, p, n.children[0].token.value, DataType.fromString(n.token.value))
			if (p.funcs[nvar.id]) {
				this.logError("A variable with the name " + JSON.stringify(nvar.id) + " already exists in the current scope", n)
			} else {
				p.vars[nvar.id] = nvar
			}
			return p
		})
		this.registerScope(AstType.Access, (n, p) => {
			let scope = p
			if (scope) scope = scope.getScope(n.children[0].token.value)
			if (!scope) {
				this.logError("No scope named " + JSON.stringify(n.children[0].token.value) + " exists in the current scope", n)
				return p
			}
			return scope
		})

		this.registerDataType(AstType.VariableId, (n) => {
			if (this.getScope(n)) {
				let nvar = this.getScope(n).getVariable(n.token.value)
				if (nvar) return nvar.type
				else this.logError("No variable named " + JSON.stringify(n.token.value) + " exists in the current scope", n)
			}
			return DataType.Invalid
		})
		this.registerDataType(AstType.FunctionId, (n) => {
			if (this.getScope(n)) {
				let func = this.getScope(n).getFunction(n.token.value)
				if (func) return func.type
				else this.logError("No function named " + JSON.stringify(n.token.value) + " exists in the current scope", n)
			}
			return DataType.Invalid
		})
		this.registerDataType(AstType.Type, (n) => DataType.Type)
		this.registerDataType(AstType.VariableDef, (n) => DataType.fromString(n.token.value))
		this.registerDataType(AstType.FunctionDef, (n) => DataType.fromString(n.token.value))
		this.registerDataType(AstType.Literal, (n) => DataType.fromTokenType(n.token.type))

		let intTypeSet = [DataType.Int, DataType.Int, DataType.Int]
		let uintTypeSet = [DataType.UInt, DataType.UInt, DataType.UInt]
		let longTypeSet = [DataType.Long, DataType.Long, DataType.Long]
		let ulongTypeSet = [DataType.ULong, DataType.ULong, DataType.ULong]
		let floatTypeSet = [DataType.Float, DataType.Float, DataType.Float]
		let doubleTypeSet = [DataType.Double, DataType.Double, DataType.Double]
		let fixedTypeSets = [intTypeSet, uintTypeSet, longTypeSet, ulongTypeSet]
		let floatingTypeSets = [floatTypeSet, doubleTypeSet]
		let signedTypeSets = [intTypeSet, longTypeSet, floatTypeSet, doubleTypeSet]
		let numberTypeSets = [intTypeSet, uintTypeSet, longTypeSet, ulongTypeSet, floatTypeSet, doubleTypeSet]
		let boolTypeSet = [DataType.Bool, DataType.Bool, DataType.Bool]
		let compareSets = [[DataType.Int, DataType.Int, DataType.Bool], [DataType.UInt, DataType.UInt, DataType.Bool], [DataType.Long, DataType.Long, DataType.Bool], [DataType.ULong, DataType.ULong, DataType.Bool], [DataType.Float, DataType.Float, DataType.Bool], [DataType.Double, DataType.Double, DataType.Bool]]

		this.registerDataTypeUnaryOp(TokenType.Neg, signedTypeSets)
		this.registerDataTypeUnaryOp(TokenType.NOT, fixedTypeSets)
		this.registerDataTypeUnaryOp(TokenType.Not, [boolTypeSet])

		this.registerDataTypeBinaryOp(TokenType.Add, numberTypeSets)
		this.registerDataTypeBinaryOp(TokenType.Sub, numberTypeSets)
		this.registerDataTypeBinaryOp(TokenType.Mul, numberTypeSets)
		this.registerDataTypeBinaryOp(TokenType.Div, numberTypeSets)
		this.registerDataTypeBinaryOp(TokenType.Mod, fixedTypeSets)
		this.registerDataTypeBinaryOp(TokenType.AND, fixedTypeSets)
		this.registerDataTypeBinaryOp(TokenType.OR, fixedTypeSets)
		this.registerDataTypeBinaryOp(TokenType.XOR, fixedTypeSets)
		this.registerDataTypeBinaryOp(TokenType.NOT, fixedTypeSets)
		this.registerDataTypeBinaryOp(TokenType.ShL, fixedTypeSets)
		this.registerDataTypeBinaryOp(TokenType.ShR, fixedTypeSets)
		this.registerDataTypeBinaryOp(TokenType.RotL, fixedTypeSets)
		this.registerDataTypeBinaryOp(TokenType.RotR, fixedTypeSets)

		this.registerDataTypeBinaryOp(TokenType.Eq, [...compareSets, boolTypeSet])
		this.registerDataTypeBinaryOp(TokenType.Ne, [...compareSets, boolTypeSet])
		this.registerDataTypeBinaryOp(TokenType.Lt, compareSets)
		this.registerDataTypeBinaryOp(TokenType.Le, compareSets)
		this.registerDataTypeBinaryOp(TokenType.Gt, compareSets)
		this.registerDataTypeBinaryOp(TokenType.Ge, compareSets)

		this.registerDataTypeBinaryOp(TokenType.And, [boolTypeSet])
		this.registerDataTypeBinaryOp(TokenType.Or, [boolTypeSet])

		this.registerDataType(AstType.Assignment, (n) => {
			let ident = this.getIdentifier(n.children[0])
			if (ident) {
				let nvar = this.getScope(ident).getVariable(ident.token.value)
				if (nvar.node.parent.parent.type == AstType.Const) {
					this.logError("Constant globals cannot be assigned to", n)
					return DataType.Invalid
				}
			}

			let t0 = this.getDataType(n.children[0])
			let t1 = this.getDataType(n.children[1])
			if (t0 == DataType.Invalid || t1 == DataType.Invalid) {
				if (t0 == DataType.Invalid) this.logError("Invalid left-hand side of assignment", n.children[0])
				if (t1 == DataType.Invalid) this.logError("Invalid right-hand side of assignment", n.children[1])
				return DataType.Invalid
			}
			if (t0 != t1) {
				this.logError("Both sides of an assignment must be of the same type", n)
				return DataType.Invalid
			}
			return t0
		})

		this.registerDataType(AstType.Global, (n) => {
			let t0 = this.getDataType(n.children[0])
			let t1 = this.getDataType(n.children[1])
			if (t0 == DataType.Invalid || t1 == DataType.Invalid) {
				if (t0 == DataType.Invalid) this.logError("Invalid left-hand side of assignment", n.children[0])
				if (t1 == DataType.Invalid) this.logError("Invalid right-hand side of assignment", n.children[1])
				return DataType.Invalid
			}
			if (t0 != t1) {
				this.logError("Both sides of an assignment must be of the same type", n)
				return DataType.Invalid
			}
			return t0
		})

		this.registerDataType(AstType.BinaryOp, (n) => {
			if (n.dataType || n.token.type != TokenType.As) return n.dataType
			let t0 = this.getDataType(n.children[0])
			let t1 = (n.children[1].type == AstType.Type) ? DataType.fromString(n.children[1].token.value) : DataType.Invalid
			if (t1 == DataType.Bool) t1 = DataType.Invalid

			if (t0 == DataType.Int && t1 == DataType.UInt) return DataType.UInt
			if (t0 == DataType.Int && t1 == DataType.Float) return DataType.Float
			if (t0 == DataType.UInt && t1 == DataType.Int) return DataType.Int
			if (t0 == DataType.UInt && t1 == DataType.Float) return DataType.Float
			if (t0 == DataType.Long && t1 == DataType.ULong) return DataType.ULong
			if (t0 == DataType.Long && t1 == DataType.Double) return DataType.Double
			if (t0 == DataType.ULong && t1 == DataType.Long) return DataType.Long
			if (t0 == DataType.ULong && t1 == DataType.Double) return DataType.Double
			if (t0 == DataType.Float && t1 == DataType.Int) return DataType.Int
			if (t0 == DataType.Float && t1 == DataType.UInt) return DataType.UInt
			if (t0 == DataType.Double && t1 == DataType.Long) return DataType.Long
			if (t0 == DataType.Double && t1 == DataType.ULong) return DataType.ULong

			if (t0 == DataType.Invalid) this.logError("Invalid value argument to operator " + TokenType[n.token.type], n.children[0])
			if (t1 == DataType.Invalid) this.logError("Invalid type argument to operator " + TokenType[n.token.type], n.children[1])
			return DataType.Invalid
		})

		this.registerDataType(AstType.BinaryOp, (n) => {
			if (n.dataType || n.token.type != TokenType.To) return n.dataType
			let t0 = this.getDataType(n.children[0])
			let t1 = (n.children[1].type == AstType.Type) ? DataType.fromString(n.children[1].token.value) : DataType.Invalid
			if (t1 == DataType.Bool) t1 = DataType.Invalid

			if (t0 == DataType.Int && t1 == DataType.Long) return DataType.Long
			if (t0 == DataType.Int && t1 == DataType.ULong) return DataType.ULong
			if (t0 == DataType.Int && t1 == DataType.Float) return DataType.Float
			if (t0 == DataType.Int && t1 == DataType.Double) return DataType.Double
			if (t0 == DataType.UInt && t1 == DataType.Long) return DataType.Long
			if (t0 == DataType.UInt && t1 == DataType.ULong) return DataType.ULong
			if (t0 == DataType.UInt && t1 == DataType.Float) return DataType.Float
			if (t0 == DataType.UInt && t1 == DataType.Double) return DataType.Double
			if (t0 == DataType.Long && t1 == DataType.Int) return DataType.Int
			if (t0 == DataType.Long && t1 == DataType.UInt) return DataType.UInt
			if (t0 == DataType.Long && t1 == DataType.Float) return DataType.Float
			if (t0 == DataType.Long && t1 == DataType.Double) return DataType.Double
			if (t0 == DataType.ULong && t1 == DataType.Int) return DataType.Int
			if (t0 == DataType.ULong && t1 == DataType.UInt) return DataType.UInt
			if (t0 == DataType.ULong && t1 == DataType.Float) return DataType.Float
			if (t0 == DataType.ULong && t1 == DataType.Double) return DataType.Double
			if (t0 == DataType.Float && t1 == DataType.Int) return DataType.Int
			if (t0 == DataType.Float && t1 == DataType.UInt) return DataType.UInt
			if (t0 == DataType.Float && t1 == DataType.Long) return DataType.Long
			if (t0 == DataType.Float && t1 == DataType.ULong) return DataType.ULong
			if (t0 == DataType.Float && t1 == DataType.Double) return DataType.Double
			if (t0 == DataType.Double && t1 == DataType.Int) return DataType.Int
			if (t0 == DataType.Double && t1 == DataType.UInt) return DataType.UInt
			if (t0 == DataType.Double && t1 == DataType.Long) return DataType.Long
			if (t0 == DataType.Double && t1 == DataType.ULong) return DataType.ULong
			if (t0 == DataType.Double && t1 == DataType.Float) return DataType.Float

			if (t0 == DataType.Invalid) this.logError("Invalid value argument to operator " + TokenType[n.token.type], n.children[0])
			if (t1 == DataType.Invalid) this.logError("Invalid type argument to operator " + TokenType[n.token.type], n.children[1])
			return DataType.Invalid
		})

		this.registerDataType(AstType.FunctionCall, (n) => {
			let ident = this.getIdentifier(n.children[0])
			let func = this.getScope(ident).getFunction(ident.token.value)
			if (!func) {
				this.logError("No function named " + JSON.stringify(ident.token.value) + " exists in the current scope", n)
				return DataType.Invalid
			}
			if (func.params.length != n.children[1].children.length) {
				this.logError("Function " + JSON.stringify(func.id) + " takes " + func.params.length + " arguments, not " + n.children[1].children.length, n)
				return DataType.Invalid
			}
			let valid = true
			for (let i = 0; i < func.params.length; i++) {
				let type = this.getDataType(n.children[1].children[i])
				if (type != func.params[i]) {
					this.logError("The " + formatOrdinal(i + 1) + " parameter of function " + JSON.stringify(func.id) + " is type " + DataType[func.params[i]] + ", not " + DataType[type], n.children[1].children[i])
					valid = false
				}
			}
			if (valid) return func.type
			else return DataType.Invalid
		})

		this.registerDataType(AstType.Return, (n) => {
			let t = this.getDataType(n.children[0])
			let p = n.parent
			while (p && p.type != AstType.FunctionDef) p = p.parent
			if (t != DataType.fromString(p.token.value) || DataType.fromString(p.token.value) == DataType.None) {
				this.logError("Type of return value (" + DataType[t] + ") does not match function " + p.children[0].token.value + "'s return type (" + DataType[DataType.fromString(p.token.value)] + ")", n.children[0])
				return DataType.Invalid
			}
			return t
		})

		this.registerDataType(AstType.ReturnVoid, (n) => {
			let p = n.parent
			while (p && p.type != AstType.FunctionDef) p = p.parent
			if (DataType.fromString(p.token.value) != DataType.None) {
				this.logError("Type of return value (" + DataType[DataType.None] + ") does not match function " + p.children[0].token.value + "'s return type (" + DataType[DataType.fromString(p.token.value)] + ")", n.children[0])
				return DataType.Invalid
			}
			return DataType.None
		})
	}

	protected registerDataTypeUnaryOp(type: TokenType, typeSets: DataType[][]) {
		this.registerDataType(AstType.UnaryOp, (n) => {
			if (n.dataType || n.token.type != type) return n.dataType
			let t = this.getDataType(n.children[0])
			for (let i = 0; i < typeSets.length; i++) {
				if (t == typeSets[i][0]) return typeSets[i][1]
			}
			this.logError("Invalid argument to operator " + TokenType[n.token.type], n.children[0])
			return DataType.Invalid
		})
	}

	protected registerDataTypeBinaryOp(type: TokenType, typeSets: DataType[][]) {
		this.registerDataType(AstType.BinaryOp, (n) => {
			if (n.dataType || n.token.type != type) return n.dataType
			let t0 = this.getDataType(n.children[0])
			let t1 = this.getDataType(n.children[1])
			for (let i = 0; i < typeSets.length; i++) {
				if (t0 == typeSets[i][0] && t1 == typeSets[i][1]) return typeSets[i][2]
			}
			this.logError("Invalid 1st argument to operator " + TokenType[n.token.type], n.children[0])
			this.logError("Invalid 2nd argument to operator " + TokenType[n.token.type], n.children[1])
			return DataType.Invalid
		})
	}

	protected getIdentifier(node: AstNode): AstNode {
		if (node.type == AstType.FunctionId || node.type == AstType.VariableId) return node
		if (node.type == AstType.Access) return this.getIdentifier(node.children[1])
		return null
	}
}