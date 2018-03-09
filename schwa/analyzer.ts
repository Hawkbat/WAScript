import { LogType, LogMsg, Logger } from "./log"
import { TokenType } from "./token"
import { AstNode, AstType } from "./ast"
import { DataType } from "./datatype"
import { Scope, Struct, Function, Variable } from "./scope"

const MAX_TYPE_DEPTH = 16

function formatOrdinal(n: number): string {
	let str = n.toFixed()
	if (str != "11" && str.endsWith('1')) return str + "st"
	else if (str != "12" && str.endsWith('2')) return str + "nd"
	else if (str != "13" && str.endsWith('3')) return str + "rd"
	else return str + "th"
}

export type ScopeRule = (n: AstNode, p: Scope) => Scope
export type DataTypeRule = (n: AstNode) => string | null
export type AnalyzeRule = (n: AstNode) => void

export class Analyzer {
	private scopeRuleMap: { [key: number]: ScopeRule[] } = {}
	private dataTypeRuleMap: { [key: number]: DataTypeRule[] } = {}
	private analysisRuleMap: { [key: number]: AnalyzeRule[] } = {}

	protected rootScope: Scope = new Scope(null, null, '')

	constructor(protected logger: Logger) { }

	public analyze(ast: AstNode) {
		this.hoistPass(ast)
		this.scopePass(ast)
		this.typePass(ast)
		this.analysisPass(ast)
	}

	protected hoistPass(node: AstNode) {
		node.scope = this.getScope(node)
		for (let child of node.children) {
			if (child.type != AstType.StructDef) continue
			this.hoistPass(child)
		}
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

	protected getDataType(node: AstNode): string {
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

	protected makeStructScope(v: Variable, p: Scope) {
		if (DataType.isPrimitive(v.type)) return
		let struct = p.getStruct(v.type)
		if (!struct) {
			if (v.node)
				this.logError('No struct named ' + v.type + ' exists in the current scope', v.node)
			return
		}
		let scope = new Scope(v.node, p, v.id)
		p.scopes[scope.id] = scope
		let offset = v.offset
		for (let field of struct.fields) {
			let nvar = new Variable(null, scope, field.id, field.type)
			scope.vars[nvar.id] = nvar
			nvar.const = v.const
			nvar.export = v.export
			nvar.mapped = v.mapped
			nvar.offset = offset
			offset += this.getSize(nvar, scope)
		}
	}

	protected getSize(v: Variable, p: Scope, depth: number = 0) {
		if (depth > MAX_TYPE_DEPTH) return 0
		switch (v.type) {
			case DataType.Int:
			case DataType.UInt:
			case DataType.Float:
			case DataType.Bool:
				return 4
			case DataType.Long:
			case DataType.ULong:
			case DataType.Double:
				return 8
		}
		if (DataType.isPrimitive(v.type)) return 0
		let struct = p.getStruct(v.type)
		if (!struct) {
			if (v.node)
				this.logError('No struct named ' + v.type + ' exists in the current scope', v.node)
			return 0
		}
		let size = 0
		for (let field of struct.fields) size += this.getSize(field, field.scope, depth + 1)
		return size
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

	protected registerBuiltinFunc(path: string, type: DataType, paramTypes: DataType[], paramNames: string[]) {
		let parts = path.split('.')
		let id = parts.pop()
		let scope = this.rootScope
		for (let i = 0; i < parts.length; i++) {
			if (!scope.scopes[parts[i]]) scope.scopes[parts[i]] = new Scope(null, scope, parts[i])
			scope = scope.scopes[parts[i]]
		}
		let params = []
		for (let i = 0; i < paramTypes.length; i++) {
			params.push(new Variable(null, scope, paramNames[i], paramTypes[i]))
		}
		if (id)
			scope.funcs[id] = new Function(null, scope, id, type, params)
	}

	protected logError(msg: string, node: AstNode) {
		this.logger.log(new LogMsg(LogType.Error, "Analyzer", msg, node.token.row, node.token.column, node.token.value.length))
	}
}

export class SchwaAnalyzer extends Analyzer {
	constructor(logger: Logger) {
		super(logger)
		this.registerBuiltinFunc('nop', DataType.None, [], [])

		this.registerBuiltinFunc('int.loadSByte', DataType.Int, [DataType.UInt], ["addr"])
		this.registerBuiltinFunc('int.loadShort', DataType.Int, [DataType.UInt], ["addr"])
		this.registerBuiltinFunc('int.load', DataType.Int, [DataType.UInt], ["addr"])
		this.registerBuiltinFunc('int.storeSByte', DataType.None, [DataType.UInt, DataType.Int], ["addr", "val"])
		this.registerBuiltinFunc('int.storeShort', DataType.None, [DataType.UInt, DataType.Int], ["addr", "val"])
		this.registerBuiltinFunc('int.store', DataType.None, [DataType.UInt, DataType.Int], ["addr", "val"])

		this.registerBuiltinFunc('uint.loadByte', DataType.UInt, [DataType.UInt], ["addr"])
		this.registerBuiltinFunc('uint.loadUShort', DataType.UInt, [DataType.UInt], ["addr"])
		this.registerBuiltinFunc('uint.load', DataType.UInt, [DataType.UInt], ["addr"])
		this.registerBuiltinFunc('uint.storeByte', DataType.None, [DataType.UInt, DataType.UInt], ["addr", "val"])
		this.registerBuiltinFunc('uint.storeUShort', DataType.None, [DataType.UInt, DataType.UInt], ["addr", "val"])
		this.registerBuiltinFunc('uint.store', DataType.None, [DataType.UInt, DataType.UInt], ["addr", "val"])

		this.registerBuiltinFunc('long.loadSByte', DataType.Long, [DataType.UInt], ["addr"])
		this.registerBuiltinFunc('long.loadShort', DataType.Long, [DataType.UInt], ["addr"])
		this.registerBuiltinFunc('long.loadInt', DataType.Long, [DataType.UInt], ["addr"])
		this.registerBuiltinFunc('long.load', DataType.Long, [DataType.UInt], ["addr"])
		this.registerBuiltinFunc('long.storeSByte', DataType.None, [DataType.UInt, DataType.Long], ["addr", "val"])
		this.registerBuiltinFunc('long.storeShort', DataType.None, [DataType.UInt, DataType.Long], ["addr", "val"])
		this.registerBuiltinFunc('long.storeInt', DataType.None, [DataType.UInt, DataType.Long], ["addr", "val"])
		this.registerBuiltinFunc('long.store', DataType.None, [DataType.UInt, DataType.Long], ["addr", "val"])

		this.registerBuiltinFunc('ulong.loadByte', DataType.ULong, [DataType.UInt], ["addr"])
		this.registerBuiltinFunc('ulong.loadUShort', DataType.ULong, [DataType.UInt], ["addr"])
		this.registerBuiltinFunc('ulong.loadUInt', DataType.ULong, [DataType.UInt], ["addr"])
		this.registerBuiltinFunc('ulong.load', DataType.ULong, [DataType.UInt], ["addr"])
		this.registerBuiltinFunc('ulong.storeByte', DataType.None, [DataType.UInt, DataType.ULong], ["addr", "val"])
		this.registerBuiltinFunc('ulong.storeUShort', DataType.None, [DataType.UInt, DataType.ULong], ["addr", "val"])
		this.registerBuiltinFunc('ulong.storeUInt', DataType.None, [DataType.UInt, DataType.ULong], ["addr", "val"])
		this.registerBuiltinFunc('ulong.store', DataType.None, [DataType.UInt, DataType.ULong], ["addr", "val"])

		this.registerBuiltinFunc('float.load', DataType.Float, [DataType.UInt], ["addr"])
		this.registerBuiltinFunc('float.store', DataType.None, [DataType.UInt, DataType.Float], ["addr", "val"])
		this.registerBuiltinFunc('double.load', DataType.Double, [DataType.UInt], ["addr", "val"])
		this.registerBuiltinFunc('double.store', DataType.None, [DataType.UInt, DataType.Double], ["addr", "val"])

		this.registerBuiltinFunc('int.clz', DataType.Int, [DataType.Int], ["n"])
		this.registerBuiltinFunc('int.ctz', DataType.Int, [DataType.Int], ["n"])
		this.registerBuiltinFunc('int.popcnt', DataType.Int, [DataType.Int], ["n"])
		this.registerBuiltinFunc('int.eqz', DataType.Int, [DataType.Int], ["n"])

		this.registerBuiltinFunc('uint.clz', DataType.UInt, [DataType.UInt], ["n"])
		this.registerBuiltinFunc('uint.ctz', DataType.UInt, [DataType.UInt], ["n"])
		this.registerBuiltinFunc('uint.popcnt', DataType.UInt, [DataType.UInt], ["n"])
		this.registerBuiltinFunc('uint.eqz', DataType.UInt, [DataType.UInt], ["n"])

		this.registerBuiltinFunc('long.clz', DataType.Long, [DataType.Long], ["n"])
		this.registerBuiltinFunc('long.ctz', DataType.Long, [DataType.Long], ["n"])
		this.registerBuiltinFunc('long.popcnt', DataType.Long, [DataType.Long], ["n"])
		this.registerBuiltinFunc('long.eqz', DataType.Long, [DataType.Long], ["n"])

		this.registerBuiltinFunc('ulong.clz', DataType.ULong, [DataType.ULong], ["n"])
		this.registerBuiltinFunc('ulong.ctz', DataType.ULong, [DataType.ULong], ["n"])
		this.registerBuiltinFunc('ulong.popcnt', DataType.ULong, [DataType.ULong], ["n"])
		this.registerBuiltinFunc('ulong.eqz', DataType.ULong, [DataType.ULong], ["n"])

		this.registerBuiltinFunc('float.abs', DataType.Float, [DataType.Float], ["n"])
		this.registerBuiltinFunc('float.ceil', DataType.Float, [DataType.Float], ["n"])
		this.registerBuiltinFunc('float.floor', DataType.Float, [DataType.Float], ["n"])
		this.registerBuiltinFunc('float.truncate', DataType.Float, [DataType.Float], ["n"])
		this.registerBuiltinFunc('float.round', DataType.Float, [DataType.Float], ["n"])
		this.registerBuiltinFunc('float.sqrt', DataType.Float, [DataType.Float], ["n"])
		this.registerBuiltinFunc('float.copysign', DataType.Float, [DataType.Float, DataType.Float], ["a", "b"])
		this.registerBuiltinFunc('float.min', DataType.Float, [DataType.Float, DataType.Float], ["a", "b"])
		this.registerBuiltinFunc('float.max', DataType.Float, [DataType.Float, DataType.Float], ["a", "b"])

		this.registerBuiltinFunc('double.abs', DataType.Double, [DataType.Double], ["n"])
		this.registerBuiltinFunc('double.ceil', DataType.Double, [DataType.Double], ["n"])
		this.registerBuiltinFunc('double.floor', DataType.Double, [DataType.Double], ["n"])
		this.registerBuiltinFunc('double.truncate', DataType.Double, [DataType.Double], ["n"])
		this.registerBuiltinFunc('double.round', DataType.Double, [DataType.Double], ["n"])
		this.registerBuiltinFunc('double.sqrt', DataType.Double, [DataType.Double], ["n"])
		this.registerBuiltinFunc('double.copysign', DataType.Double, [DataType.Double, DataType.Double], ["a", "b"])
		this.registerBuiltinFunc('double.min', DataType.Double, [DataType.Double, DataType.Double], ["a", "b"])
		this.registerBuiltinFunc('double.max', DataType.Double, [DataType.Double, DataType.Double], ["a", "b"])

		this.registerScope(AstType.Program, (n, p) => {
			let scope = new Scope(n, p, '')
			p.scopes[scope.id] = scope
			return scope
		})
		this.registerScope(AstType.Block, (n, p) => {
			let scope = new Scope(n, p, '')
			p.scopes[scope.id] = scope
			return scope
		})
		this.registerScope(AstType.StructDef, (n, p) => {
			let scope = new Scope(n, p, n.children[0].token.value)
			let fields: Variable[] = []
			let fieldNodes = n.children[1].children
			for (let i = 0; i < fieldNodes.length; i++) {
				if (fieldNodes[i].type != AstType.VariableDef) continue
				fields.push(new Variable(n, scope, fieldNodes[i].children[0].token.value, fieldNodes[i].token.value))
			}
			let struct = new Struct(n, scope, n.children[0].token.value, fields)
			if (p.structs[struct.id]) {
				this.logError("A struct with the name " + JSON.stringify(struct.id) + " already exists in the current scope", n)
			} else {
				p.structs[struct.id] = struct
				p.scopes[scope.id] = scope
			}
			return scope
		})
		this.registerScope(AstType.FunctionDef, (n, p) => {
			let scope = new Scope(n, p, n.children[0].token.value)
			let params: Variable[] = []
			let paramNodes = n.children[1].children
			for (let i = 0; i < paramNodes.length; i++) {
				params.push(new Variable(n, scope, paramNodes[i].children[0].token.value, paramNodes[i].token.value))
			}
			let func = new Function(n, scope, n.children[0].token.value, n.token.value, params)
			if (p.funcs[func.id]) {
				this.logError("A function with the name " + JSON.stringify(func.id) + " already exists in the current scope", n)
			} else {
				p.funcs[func.id] = func
				p.scopes[scope.id] = scope
			}
			return scope
		})
		this.registerScope(AstType.VariableDef, (n, p) => {
			let nvar = new Variable(n, p, n.children[0].token.value, n.token.value)
			if (p.vars[nvar.id]) {
				this.logError("A variable with the name " + JSON.stringify(nvar.id) + " already exists in the current scope", n)
			} else {
				p.vars[nvar.id] = nvar

				let pn = n.parent
				while (pn && pn.type != AstType.Global) pn = pn.parent
				if (pn && pn.type == AstType.Global) nvar.global = true

				pn = n.parent
				while (pn && pn.type != AstType.Map) pn = pn.parent
				if (pn && pn.type == AstType.Map) {
					nvar.global = true
					nvar.mapped = true
					if (pn.children.length >= 2) {
						nvar.offset = parseInt(pn.children[1].token.value)
					}
				}

				//this.makeStructScope(nvar, p)
			}
			return p
		})
		this.registerScope(AstType.Access, (n, p) => {
			let scope: Scope | null = p
			if (scope) scope = scope.getScope(n.children[0].token.value)
			if (!scope) {
				let nvar = p.getVariable(n.children[0].token.value)
				if (nvar) {
					this.makeStructScope(nvar, p)
					scope = p.getScope(n.children[0].token.value)
					if (scope) return scope
				}
				this.logError("No scope named " + JSON.stringify(n.children[0].token.value) + " exists in the current scope", n)
				return p
			}
			return scope
		})
		this.registerScope(AstType.Const, (n, p) => {
			let node = n.parent
			while (node && node.children) node = node.children[0]
			if (node) {
				let nvar = p.getVariable(node.token.value)
				if (nvar) nvar.const = true
			}
			return p
		})
		this.registerScope(AstType.Export, (n, p) => {
			let node = n.parent
			while (node && node.children) node = node.children[0]
			if (node) {
				let nvar = p.getVariable(node.token.value)
				if (nvar) nvar.export = true
				let func = p.getFunction(node.token.value)
				if (func) func.export = true
				let struct = p.getStruct(node.token.value)
				if (struct) struct.export = true
			}
			return p
		})

		this.registerDataType(AstType.Access, (n) => {
			if (n.children.length >= 2) {
				let node = this.getIdentifier(n)
				if (node) return this.getDataType(node)
			}
			return DataType.Invalid
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
		this.registerDataType(AstType.StructId, (n) => {
			if (this.getScope(n)) {
				let struct = this.getScope(n).getStruct(n.token.value)
				if (struct) return struct.id
				else this.logError("No struct named " + JSON.stringify(n.token.value) + " exists in the current scope", n)
			}
			return DataType.Invalid
		})
		this.registerDataType(AstType.Type, (n) => DataType.Type)
		this.registerDataType(AstType.VariableDef, (n) => n.token.value)
		this.registerDataType(AstType.FunctionDef, (n) => n.token.value)
		this.registerDataType(AstType.StructDef, (n) => n.children[0].token.value)
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
				if (nvar && nvar.const) {
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
			let t1 = (n.children[1].type == AstType.Type) ? n.children[1].token.value : DataType.Invalid
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
			let t1 = (n.children[1].type == AstType.Type) ? n.children[1].token.value : DataType.Invalid
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
			if (!ident) {
				this.logError("Invalid function identifier", n)
				return DataType.Invalid
			}
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
				if (type != func.params[i].type) {
					this.logError("The " + formatOrdinal(i + 1) + " parameter (" + JSON.stringify(func.params[i].id) + ") of function " + JSON.stringify(func.id) + " is type " + func.params[i].type + ", not " + type, n.children[1].children[i])
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
			if (p && (t != p.token.value || p.token.value == DataType.None)) {
				this.logError("Type of return value (" + t + ") does not match function " + p.children[0].token.value + "'s return type (" + p.token.value + ")", n.children[0])
				return DataType.Invalid
			}
			return t
		})

		this.registerDataType(AstType.ReturnVoid, (n) => {
			let p = n.parent
			while (p && p.type != AstType.FunctionDef) p = p.parent
			if (p && p.token.value != DataType.None) {
				this.logError("Type of return value (" + DataType.None + ") does not match function " + p.children[0].token.value + "'s return type (" + p.token.value + ")", n.children[0])
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

	protected getIdentifier(node: AstNode): AstNode | null {
		if (node.type == AstType.FunctionId || node.type == AstType.VariableId) return node
		if (node.type == AstType.Access) return this.getIdentifier(node.children[1])
		return null
	}
}