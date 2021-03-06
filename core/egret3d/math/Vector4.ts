namespace egret3d {
    /**
     * 
     */
    export interface IVector4 extends IVector3 {
        /**
         * w 轴分量。
         */
        w: number;
    }
    /**
     * 
     */
    export class Vector4 extends paper.BaseRelease<Vector4> implements IVector4, paper.ICCS<Vector4>, paper.ISerializable {

        protected static readonly _instances: Vector4[] = [];
        /**
         * 
         */
        public static create(x: number = 0.0, y: number = 0.0, z: number = 0.0, w: number = 1.0) {
            if (this._instances.length > 0) {
                const instance = this._instances.pop()!.set(x, y, z, w);
                instance._released = false;
                return instance;
            }

            return new Vector4().set(x, y, z, w);
        }

        public x: number;
        public y: number;
        public z: number;
        public w: number;
        /**
         * 请使用 `egret3d.Vector4.create(); egret3d.Quaternion.create()` 创建实例。
         * @see egret3d.Quaternion.create()
         * @see egret3d.Vector4.create()
         * @deprecated
         */
        public constructor(x: number = 0.0, y: number = 0.0, z: number = 0.0, w: number = 1.0) {
            super();

            this.x = x;
            this.y = y;
            this.z = z;
            this.w = w;
        }

        public serialize() {
            return [this.x, this.y, this.z, this.w];
        }

        public deserialize(value: Readonly<[number, number, number, number]>) {
            return this.fromArray(value);
        }

        public copy(value: Readonly<IVector4>) {
            return this.set(value.x, value.y, value.z, value.w);
        }

        public clone() {
            return Vector4.create(this.x, this.y, this.z, this.w);
        }

        public set(x: number, y: number, z: number, w: number) {
            this.x = x;
            this.y = y;
            this.z = z;
            this.w = w;

            return this;
        }

        public clear() {
            this.x = 0.0;
            this.y = 0.0;
            this.z = 0.0;
            this.w = 1.0;

            return this;
        }

        public fromArray(value: ArrayLike<number>, offset: number = 0) {
            this.x = value[offset];
            this.y = value[offset + 1];
            this.z = value[offset + 2];
            this.w = value[offset + 3];

            return this;
        }
        /**
         * 判断该向量是否和一个向量相等。
         * @param value 一个向量。
         * @param threshold 阈值。
         */
        public equal(value: Readonly<IVector4>, threshold: number = 0.000001) {
            if (
                Math.abs(this.x - value.x) <= threshold &&
                Math.abs(this.y - value.y) <= threshold &&
                Math.abs(this.z - value.z) <= threshold &&
                Math.abs(this.w - value.w) <= threshold
            ) {
                return true;
            }

            return false;
        }
        /**
         * 归一化该向量。
         * - v /= v.length
         */
        public normalize(): this;
        /**
         * 将输入向量的归一化结果写入该向量。
         * - v = input / input.length
         * @param input 输入向量。
         */
        public normalize(input: Readonly<IVector4>): this;
        public normalize(input?: Readonly<IVector4>) {
            if (!input) {
                input = this;
            }

            const x = input.x, y = input.y, z = input.z, w = input.w;
            let l = Math.sqrt(x * x + y * y + z * z + w * w);
            if (l > Const.EPSILON) {
                l = 1.0 / l;
                this.x = x * l;
                this.y = y * l;
                this.z = z * l;
                this.w = w * l;
            }
            else {
                this.clear();
            }

            return this;
        }
        /**
         * 反转该向量。
         */
        public inverse(): this;
        /**
         * 将输入向量的反转结果写入该向量。
         * @param input 输入向量。
         */
        public inverse(input: Readonly<IVector4>): this;
        public inverse(input?: Readonly<IVector4>) {
            if (!input) {
                input = this;
            }

            this.x = input.x * -1;
            this.y = input.y * -1;
            this.z = input.z * -1;
            this.w = input.w;

            return this;
        }
        /**
         * 向量与标量相乘运算。
         * - `v.multiplyScalar(scalar)` 将该向量与标量相乘，相当于 v *= scalar。
         * - `v.multiplyScalar(scalar, input)` 将输入向量与标量相乘的结果写入该向量，相当于 v = input * scalar。
         * @param scalar 标量。
         * @param input 输入向量。
         */
        public multiplyScalar(scalar: number, input?: Readonly<IVector4>): this {
            if (!input) {
                input = this;
            }

            this.x = scalar * input.x;
            this.y = scalar * input.y;
            this.z = scalar * input.z;
            this.w = scalar * input.w;

            return this;
        }
        /**
         * 将该向量与一个向量相点乘。
         * - v · vector
         * @param vector 一个向量。
         */
        public dot(vector: Readonly<IVector4>): number {
            return this.x * vector.x + this.y * vector.y + this.z * vector.z + this.w * vector.w;
        }
        /**
         * 将该向量和目标向量插值的结果写入该向量。
         * - v = v * (1 - t) + to * t
         * - 插值因子不会被限制在 0 ~ 1。
         * @param to 目标矩阵。
         * @param t 插值因子。
         */
        public lerp(to: Readonly<IVector4>, t: number): this;
        /**
         * 将两个向量插值的结果写入该向量。
         * - v = from * (1 - t) + to * t
         * - 插值因子不会被限制在 0 ~ 1。
         * @param from 起始矩阵。
         * @param to 目标矩阵。
         * @param t 插值因子。
         */
        public lerp(from: Readonly<IVector4>, to: Readonly<IVector4>, t: number): this;
        /**
         * @deprecated
         */
        public lerp(t: number, to: Readonly<IVector4>): this;
        /**
         * @deprecated
         */
        public lerp(t: number, from: Readonly<IVector4>, to: Readonly<IVector4>): this;
        public lerp(p1: Readonly<IVector4> | number, p2: Readonly<IVector4> | number, p3?: number | Readonly<IVector4>) {
            if (typeof p1 === "number") {
                if (!p3) {
                    p3 = p1;
                    p1 = this;
                }
                else {
                    const temp = p1;
                    p1 = p2;
                    p2 = p3;
                    p3 = temp;
                }
            }
            else if (typeof p2 === "number") {
                p3 = p2;
                p2 = p1;
                p1 = this;
            }

            this.x = (p1 as Readonly<IVector4>).x + ((p2 as Readonly<IVector4>).x - (p1 as Readonly<IVector4>).x) * <number>p3;
            this.y = (p1 as Readonly<IVector4>).y + ((p2 as Readonly<IVector4>).y - (p1 as Readonly<IVector4>).y) * <number>p3;
            this.z = (p1 as Readonly<IVector4>).z + ((p2 as Readonly<IVector4>).z - (p1 as Readonly<IVector4>).z) * <number>p3;
            this.w = (p1 as Readonly<IVector4>).w + ((p2 as Readonly<IVector4>).w - (p1 as Readonly<IVector4>).w) * <number>p3;

            return this;
        }
        /**
         * 将该向量转换为数组。
         * @param array 数组。
         * @param offset 数组偏移。
         */
        public toArray(array?: number[] | Float32Array, offset: number = 0) {
            if (!array) {
                array = [];
            }

            array[0 + offset] = this.x;
            array[1 + offset] = this.y;
            array[2 + offset] = this.z;
            array[3 + offset] = this.w;

            return array;
        }
        /**
         * 该向量的长度。
         * - 该值是实时计算的。
         */
        public get length(): number {
            return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w);
        }
        /**
         * 该向量的长度的平方。
         * - 该值是实时计算的。
         */
        public get squaredLength(): number {
            return this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w;
        }
    }
}