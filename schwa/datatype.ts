import { TokenType } from './token'

export enum DataType {
	None = 'void',
	Invalid = 'invalid',
	Type = 'type',
	Int = 'int',
	UInt = 'uint',
	Long = 'long',
	ULong = 'ulong',
	Float = 'float',
	Double = 'double',
	Bool = 'bool'
}

export namespace DataType {
	export function fromTokenType(type: TokenType): DataType {
		if (type == TokenType.Int) return DataType.Int
		if (type == TokenType.UInt) return DataType.UInt
		if (type == TokenType.Long) return DataType.Long
		if (type == TokenType.ULong) return DataType.ULong
		if (type == TokenType.Float) return DataType.Float
		if (type == TokenType.Double) return DataType.Double
		if (type == TokenType.Bool) return DataType.Bool
		return DataType.Invalid
	}

	export function isPrimitive(type: string): boolean {
		if (type == DataType.None) return true
		if (type == DataType.Invalid) return true
		if (type == DataType.Type) return true
		if (type == DataType.Int) return true
		if (type == DataType.UInt) return true
		if (type == DataType.Long) return true
		if (type == DataType.ULong) return true
		if (type == DataType.Float) return true
		if (type == DataType.Double) return true
		if (type == DataType.Bool) return true
		return false
	}
}