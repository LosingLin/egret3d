namespace paper {
    Layer.Default; // egret build bug.
    /**
     * 实体。
     */
    export class GameObject extends BaseObject {
        /**
         * @internal
         */
        public static readonly _instances: GameObject[] = [];
        private static _globalGameObject: GameObject | null = null;
        /**
         * 创建实体，并添加到当前场景中。
         */
        public static create(name: string = DefaultNames.NoName, tag: string = DefaultTags.Untagged, scene: Scene | null = null) {
            let gameObect: GameObject;
            // if (this._instances.length > 0) {
            //     gameObect = this._instances.pop()!;

            //     gameObect.name = name;
            //     gameObect.tag = tag;
            //     gameObect._addToScene(scene);
            //     gameObect.addComponent(egret3d.Transform);
            // }
            // else {
            gameObect = new GameObject(name, tag, scene);
            // gameObect = new GameObject();
            // }

            // gameObect.name = name;
            // gameObect.tag = tag;
            // gameObect._addToScene(Application.sceneManager.activeScene);
            // gameObect.addComponent(egret3d.Transform);

            return gameObect;
        }
        /**
         * 全局实体。
         * - 全局实体不可被销毁。
         * - 静态组件都会添加到全局实体上。
         */
        public static get globalGameObject() {
            if (!this._globalGameObject) {
                this._globalGameObject = GameObject.create(DefaultNames.Global, DefaultTags.Global, Scene.globalScene);
                this._globalGameObject.dontDestroy = true;
            }

            return this._globalGameObject;
        }
        /**
         * 是否是静态模式。
         */
        @serializedField
        @editor.property(editor.EditType.CHECKBOX)
        public isStatic: boolean = false;
        /**
         * 名称。
         */
        @serializedField
        @editor.property(editor.EditType.TEXT)
        public name: string = "";
        /**
         * 标签。
         */
        @serializedField
        @editor.property(editor.EditType.LIST, { listItems: editor.getItemsFromEnum((paper as any).DefaultTags) }) // TODO
        public tag: paper.DefaultTags | string = "";
        /**
         * 层级。
         * - 用于各种层遮罩。
         */
        @serializedField
        @editor.property(editor.EditType.LIST, { listItems: editor.getItemsFromEnum((paper as any).Layer) }) // TODO
        public layer: Layer = Layer.Default;
        /**
         * 
         */
        @serializedField
        @editor.property(editor.EditType.LIST, { listItems: editor.getItemsFromEnum((paper as any).HideFlags) }) // TODO
        public hideFlags: HideFlags = HideFlags.None;
        /**
         * 变换组件。
         * @readonly
         */
        public transform: egret3d.Transform = null!;
        /**
         * 渲染组件。
         * @readonly
         */
        public renderer: BaseRenderer | null = null;
        /**
         * 额外数据，仅保存在编辑器环境，项目发布该数据将被移除。
         */
        @serializedField
        public extras?: GameObjectExtras = Application.playerMode === PlayerMode.Editor ? {} : undefined;

        @serializedField // TODO 反序列化 bug
        private _activeSelf: boolean = true;
        /**
         * @internal
         */
        public _activeInHierarchy: boolean = true;
        /**
         * @internal
         */
        public _activeDirty: boolean = true;
        private readonly _components: (BaseComponent | undefined)[] = [];
        /**
         * @internal
         */
        public readonly _beforeRenderBehaviors: Behaviour[] = [];
        private readonly _cachedComponents: BaseComponent[] = [];
        private _scene: Scene | null = null;
        /**
         * 请使用 `paper.GameObject.create()` 创建实例。
         * @see paper.GameObject.create()
         * @deprecated
         */
        public constructor(name: string = DefaultNames.NoName, tag: string = DefaultTags.Untagged, scene: Scene | null = null) {
            super();

            this.name = name;
            this.tag = tag;
            //
            this._addToScene(scene || Application.sceneManager.activeScene);
            //
            this.addComponent(egret3d.Transform);
        }

        private _destroy() {
            this._scene!.removeGameObject(this);

            for (const child of this.transform.children) {
                child.gameObject._destroy();
            }

            for (const component of this._components) {
                if (!component) {
                    continue;
                }

                this._removeComponent(component, null);
            }

            // 销毁的第一时间就将组件和场景清除，用场景的有无来判断实体是否已经销毁。
            this._components.length = 0;
            this._scene = null;
            disposeCollecter.gameObjects.push(this);
        }

        private _addToScene(value: Scene): any {
            if (this._scene) {
                this._scene.removeGameObject(this);
            }

            this._scene = value;
            this._scene.addGameObject(this);
        }

        private _canRemoveComponent(value: BaseComponent) {
            if (value === this.transform) {
                console.warn("Cannot remove the transform component from a game object.");
                return false;
            }

            for (let component of this._components) {
                if (!component) {
                    continue;
                }

                if (component.constructor === GroupComponent) {
                    component = (component as GroupComponent).components[0]; // 只检查第一个。
                }

                const requireComponents = (component.constructor as IComponentClass<BaseComponent>).requireComponents;
                if (requireComponents && requireComponents.indexOf(value.constructor as IComponentClass<BaseComponent>) >= 0) {
                    console.warn(`Cannot remove the ${egret.getQualifiedClassName(value)} component from the game object (${this.path}), because it is required from the ${egret.getQualifiedClassName(component)} component.`);
                    return false;
                }
            }

            return true;
        }

        private _removeComponent(value: BaseComponent, groupComponent: GroupComponent | null) {
            disposeCollecter.components.push(value);

            value.enabled = false;

            if ((value.constructor as IComponentClass<BaseComponent>).__isBehaviour) {
                if ((value as Behaviour)._isAwaked) {
                    (value as Behaviour).onDestroy && (value as Behaviour).onDestroy!();
                }

                if ((value as Behaviour).onBeforeRender) {
                    this._beforeRenderBehaviors.splice(this._beforeRenderBehaviors.indexOf(value as Behaviour), 1);
                }
            }

            value.uninitialize(); //
            (value as any).gameObject = null;

            if (value === this.renderer) {
                this.renderer = null;
            }

            if (groupComponent) {
                groupComponent.removeComponent(value);

                if (groupComponent.components.length === 0) {
                    this._removeComponent(groupComponent, null);
                }
            }
            else if (value.constructor === GroupComponent) {
                groupComponent = value as GroupComponent;
                delete this._components[groupComponent.componentIndex];

                for (const componentInGroup of groupComponent.components) {
                    this._removeComponent(componentInGroup, groupComponent);
                }
            }
            else {
                delete this._components[(value.constructor as IComponentClass<BaseComponent>).__index];
            }

            if (this.transform && value.hasOwnProperty("onTransformChange")) { // TODO 字符串依赖。
                this.transform.unregisterObserver(value as any);
            }
        }

        private _getComponent(componentClass: IComponentClass<BaseComponent>) {
            const componentIndex = componentClass.__index;
            return componentIndex < 0 ? null : this._components[componentIndex];
        }
        /**
         * @internal
         */
        public _activeInHierarchyDirty(prevActive: boolean) {
            this._activeDirty = true;
            const currentActive = this.activeInHierarchy;

            if (currentActive !== prevActive) {
                for (const component of this._components) {
                    if (!component) {
                        continue;
                    }

                    if (component.constructor === GroupComponent) {
                        for (const componentInGroup of (component as GroupComponent).components) {
                            if (
                                (componentInGroup.constructor as IComponentClass<BaseComponent>).__isBehaviour &&
                                !(<any>componentInGroup as Behaviour)._isAwaked &&
                                (Application.playerMode !== PlayerMode.Editor || (componentInGroup.constructor as IComponentClass<Behaviour>).executeInEditMode)
                            ) {
                                (<any>componentInGroup as Behaviour).onAwake && (<any>componentInGroup as Behaviour).onAwake!();
                                (<any>componentInGroup as Behaviour)._isAwaked = true;
                            }

                            if (componentInGroup.enabled) {
                                componentInGroup._dispatchEnabledEvent(currentActive);
                            }
                        }
                    }
                    else {
                        if (
                            (component.constructor as IComponentClass<BaseComponent>).__isBehaviour &&
                            !(<any>component as Behaviour)._isAwaked &&
                            (Application.playerMode !== PlayerMode.Editor || (component.constructor as IComponentClass<Behaviour>).executeInEditMode)
                        ) {
                            (<any>component as Behaviour).onAwake && (<any>component as Behaviour).onAwake!();
                            (<any>component as Behaviour)._isAwaked = true;
                        }

                        if (component.enabled) {
                            component._dispatchEnabledEvent(currentActive);
                        }
                    }
                }
            }

            for (const child of this.transform.children) {
                child.gameObject._activeInHierarchyDirty(prevActive);
            }
        }
        /**
         * 实体被销毁后，内部卸载。
         * @internal
         */
        public uninitialize() {
            this.isStatic = false;
            this.hideFlags = HideFlags.None;
            this.layer = Layer.Default;
            this.name = "";
            this.tag = "";
            this.transform = null!;
            this.renderer = null;

            if (this.extras) { // Editor. TODO
                this.extras = {};
            }

            this._activeSelf = true;
            this._activeInHierarchy = true;
            this._activeDirty = true;

            this._cachedComponents.length = 0;
            this._scene = null;
        }
        /**
         * 销毁实体。
         */
        public destroy() {
            if (this.isDestroyed) {
                console.warn(`The game object has been destroyed.`);
                return false;
            }

            if (this === GameObject._globalGameObject) {
                console.warn("Cannot destroy global game object.");
                return false;
            }

            const parent = this.transform.parent;
            if (parent) {
                parent._children.splice(parent._children.indexOf(this.transform), 1);
            }

            this._destroy();

            return true;
        }
        /**
         * 添加一个指定组件实例。
         * @param componentClass 组件类。
         * @param config BaseComponent 组件 `initialize(config?: any)` 方法或 Behaviour 组件 `onAwake(config?: any)` 方法的可选参数。
         */
        public addComponent<T extends BaseComponent>(componentClass: IComponentClass<T>, config?: any): T {
            if (DEBUG && !componentClass) {
                throw new Error();
            }

            registerClass(componentClass);
            // SingletonComponent.
            if (componentClass.__isSingleton && this !== GameObject._globalGameObject) {
                return GameObject.globalGameObject.getOrAddComponent(componentClass, config);
            }

            const componentIndex = componentClass.__index;
            const existedComponent = this._components[componentIndex];
            // disallowMultipleComponents.
            if (!componentClass.allowMultiple && existedComponent) {
                console.warn(`Cannot add the ${egret.getQualifiedClassName(componentClass)} component to the game object (${this.path}) again.`);
                return existedComponent as T;
            }
            // requireComponents.
            if (componentClass.requireComponents) {
                for (const requireComponentClass of componentClass.requireComponents) {
                    this.getOrAddComponent(requireComponentClass);
                }
            }
            // Linked reference.
            const component = BaseComponent.create(componentClass, this);
            if (componentClass === egret3d.Transform as any) {
                this.transform = <any>component as egret3d.Transform;
            }
            else if (component instanceof BaseRenderer) {
                this.renderer = component;
            }
            else if ((component.constructor as IComponentClass<T>).__isBehaviour) {
                if ((<any>component as Behaviour).onBeforeRender) {
                    this._beforeRenderBehaviors.push(<any>component as Behaviour);
                }
            }
            // Add component.
            if (existedComponent) {
                if (existedComponent.constructor === GroupComponent) {
                    (existedComponent as GroupComponent).addComponent(component);
                }
                else {
                    registerClass(GroupComponent);
                    const groupComponent = BaseComponent.create(GroupComponent as any, this) as GroupComponent;
                    groupComponent.initialize();
                    groupComponent.componentIndex = componentIndex;
                    groupComponent.componentClass = componentClass;
                    groupComponent.addComponent(existedComponent);
                    groupComponent.addComponent(component);
                    this._components[componentIndex] = groupComponent;
                }
            }
            else {
                this._components[componentIndex] = component;
            }

            // Component initialize.
            if (config) {
                component.initialize(config);
            }
            else {
                component.initialize();
            }

            if (this.activeInHierarchy) {
                if (
                    (component.constructor as IComponentClass<BaseComponent>).__isBehaviour &&
                    (Application.playerMode !== PlayerMode.Editor || (component.constructor as IComponentClass<Behaviour>).executeInEditMode)
                ) {
                    (<any>component as Behaviour).onAwake && (<any>component as Behaviour).onAwake!(config);
                    (<any>component as Behaviour)._isAwaked = true;
                }

                if (component.enabled) {
                    component._dispatchEnabledEvent(true);
                }
            }

            return component;
        }
        /**
         * 移除一个指定组件实例。
         * @param componentInstanceOrClass 组件类或组件实例。
         * @param isExtends 是否尝试移除全部派生自此组件的实例。
         */
        public removeComponent<T extends BaseComponent>(componentInstanceOrClass: IComponentClass<T> | T, isExtends: boolean = false): void {
            if (DEBUG && !componentInstanceOrClass) {
                throw new Error();
            }

            if (componentInstanceOrClass instanceof BaseComponent) {
                const componentClass = componentInstanceOrClass.constructor as IComponentClass<T>;
                if (componentClass.__isSingleton && this !== GameObject._globalGameObject) { // SingletonComponent.
                    GameObject.globalGameObject.removeComponent(componentInstanceOrClass, isExtends);
                    return;
                }

                if (!this._canRemoveComponent(componentInstanceOrClass)) {
                    return;
                }

                this._removeComponent(componentInstanceOrClass, null);
            }
            else {
                if (componentInstanceOrClass.__isSingleton && this !== GameObject._globalGameObject) { // SingletonComponent.
                    return GameObject.globalGameObject.removeComponent(componentInstanceOrClass, isExtends);
                }

                if (isExtends) {
                    for (let component of this._components) {
                        if (!component) {
                            continue;
                        }

                        let groupComponent: GroupComponent | null = null;
                        if (component.constructor === GroupComponent) {
                            groupComponent = component as GroupComponent;
                            component = groupComponent.components[0];
                        }

                        if (groupComponent) {
                            if (
                                !(groupComponent.components[0] instanceof componentInstanceOrClass) ||
                                (groupComponent.components.length === 1 && !this._canRemoveComponent(groupComponent.components[0]))
                            ) {
                                continue;
                            }
                        }
                        else if (
                            !(component instanceof componentInstanceOrClass) ||
                            !this._canRemoveComponent(component)
                        ) {
                            continue;
                        }

                        this._removeComponent(component, groupComponent);
                    }
                }
                else {
                    let component = this._getComponent(componentInstanceOrClass);
                    if (!component) {
                        return;
                    }

                    let groupComponent: GroupComponent | null = null;
                    if (component.constructor === GroupComponent) {
                        groupComponent = component as GroupComponent;
                        component = groupComponent.components[0];
                    }

                    if (groupComponent) {
                        if (groupComponent.components.length === 1 && !this._canRemoveComponent(groupComponent.components[0])) {
                            return;
                        }
                    }
                    else if (!this._canRemoveComponent(component)) {
                        return;
                    }

                    this._removeComponent(component, groupComponent);
                }
            }
        }
        /**
         * 移除全部指定组件的实例。
         * - 通常只有该组件类允许同一个实体添加多个组件实例时才需要此操作。
         * @param componentClass 组件类。
         * @param isExtends 是否尝试移除全部派生自此组件的实例。
         */
        public removeAllComponents<T extends BaseComponent>(componentClass?: IComponentClass<T>, isExtends: boolean = false) {
            if (componentClass) {
                if (componentClass.__isSingleton && this !== GameObject._globalGameObject) { // SingletonComponent.
                    GameObject.globalGameObject.removeAllComponents(componentClass, isExtends);
                    return;
                }

                if (isExtends) {
                    for (const component of this._components) {
                        if (!component) {
                            continue;
                        }

                        if (component.constructor === GroupComponent) {
                            const groupComponent = component as GroupComponent;
                            if (
                                !(groupComponent.components[0] instanceof componentClass) ||
                                !this._canRemoveComponent(groupComponent.components[0])
                            ) {
                                continue;
                            }
                        }
                        else if (!this._canRemoveComponent(component)) {
                            continue;
                        }

                        this._removeComponent(component, null);
                    }
                }
                else {
                    const component = this._getComponent(componentClass);
                    if (!component) {
                        return;
                    }

                    if (component.constructor === GroupComponent) {
                        const groupComponent = component as GroupComponent;
                        if (!this._canRemoveComponent(groupComponent.components[0])) {
                            return;
                        }
                    }
                    else if (!this._canRemoveComponent(component)) {
                        return;
                    }

                    this._removeComponent(component, null);
                }
            }
            else {
                for (const component of this._components) {
                    if (!component || component.constructor === egret3d.Transform) {
                        continue;
                    }

                    this._removeComponent(component, null);
                }
            }
        }
        /**
         * 获取一个指定组件实例。
         * @param componentClass 组件类。
         * @param isExtends 是否尝试获取全部派生自此组件的实例。
         */
        public getComponent<T extends BaseComponent>(componentClass: IComponentClass<T>, isExtends: boolean = false): T | null {
            if (componentClass.__isSingleton && this !== GameObject._globalGameObject) { // SingletonComponent.
                return GameObject.globalGameObject.getComponent(componentClass, isExtends);
            }

            if (isExtends) {
                for (const component of this._components) {
                    if (!component) {
                        continue;
                    }

                    if (component.constructor === GroupComponent) {
                        const groupComponent = component as GroupComponent;
                        if (groupComponent.components[0] instanceof componentClass) {
                            return groupComponent.components[0] as T;
                        }
                    }
                    else if (component instanceof componentClass) {
                        return component as T;
                    }
                }

                return null;
            }

            const componentClassIndex = componentClass.__index;
            if (componentClassIndex < 0) {
                return null;
            }

            const component = this._components[componentClassIndex];
            if (!component) {
                return null;
            }

            if (component.constructor === GroupComponent) {
                return (component as GroupComponent).components[0] as T;
            }

            return component as T;
        }
        /**
         * 获取全部指定组件实例。
         * @param componentClass 组件类。
         * @param isExtends 是否尝试获取全部派生自此组件的实例。
         */
        public getComponents<T extends BaseComponent>(componentClass: IComponentClass<T>, isExtends: boolean = false): T[] {
            if (componentClass.__isSingleton && this !== GameObject._globalGameObject) { // SingletonComponent.
                return GameObject.globalGameObject.getComponents(componentClass, isExtends);
            }

            const components: T[] = [];

            if (isExtends) {
                for (const component of this._components) {
                    if (!component) {
                        continue;
                    }

                    if (component.constructor === GroupComponent && (component as GroupComponent).components[0] instanceof componentClass) {
                        for (const componentInGroup of (component as GroupComponent).components) {
                            components.push(componentInGroup as T);
                        }
                    }
                    else if (component instanceof componentClass) {
                        components.push(component as T);
                    }
                }
            }
            else {
                const component = this._getComponent(componentClass);
                if (component) {
                    if (component.constructor === GroupComponent && (component as GroupComponent).components[0] instanceof componentClass) {
                        for (const componentInGroup of (component as GroupComponent).components) {
                            components.push(componentInGroup as T);
                        }
                    }
                    else if (component instanceof componentClass) {
                        components.push(component as T);
                    }
                }
            }

            return components;
        }
        /**
         * 获取一个自己或父级中指定的组件实例。
         * @param componentClass 组件类。
         * @param isExtends 是否尝试获取全部派生自此组件的实例。
         */
        public getComponentInParent<T extends BaseComponent>(componentClass: IComponentClass<T>, isExtends: boolean = false) {
            let result: T | null = null;
            let parent = this.transform.parent;

            while (!result && parent) {
                result = parent.gameObject.getComponent(componentClass, isExtends) as T | null; // 
                parent = parent.parent;
            }

            return result;
        }
        /**
         * 获取一个自己或子（孙）级中指定的组件实例。
         * @param componentClass 组件类。
         * @param isExtends 是否尝试获取全部派生自此组件的实例。
         */
        public getComponentInChildren<T extends BaseComponent>(componentClass: IComponentClass<T>, isExtends: boolean = false): T | null {
            let component = this.getComponent(componentClass, isExtends);
            if (!component) {
                for (const child of this.transform.children) {
                    component = child.gameObject.getComponentInChildren(componentClass, isExtends);
                    if (component) {
                        break;
                    }
                }
            }

            return component;
        }
        /**
         * 获取全部自己和子（孙）级中指定的组件实例。
         * @param componentClass 组件类。
         * @param isExtends 是否尝试获取全部派生自此组件的实例。
         */
        public getComponentsInChildren<T extends BaseComponent>(componentClass: IComponentClass<T>, isExtends: boolean = false, components: T[] | null = null) {
            components = components || [];

            for (const component of this._components) {
                if (!component) {
                    continue;
                }

                if (component.constructor === GroupComponent) {
                    const groupComponent = component as GroupComponent;
                    if (isExtends ? groupComponent.components[0] instanceof componentClass : groupComponent.componentClass === componentClass) {
                        for (const componentInGroup of groupComponent.components) {
                            components.push(componentInGroup as T);
                        }
                    }
                }
                else if (isExtends ? component instanceof componentClass : component.constructor === componentClass) {
                    components.push(component as T);
                }
            }

            for (const child of this.transform.children) {
                child.gameObject.getComponentsInChildren(componentClass, isExtends, components);
            }

            return components;
        }
        /**
         * 从该实体已注册的全部组件中获取一个指定组件实例，如果未添加该组件，则添加该组件。
         * @param componentClass 组件类。
         * @param isExtends 是否尝试获取全部派生自此组件的实例。
         * @param config BaseComponent 组件 `initialize(config?: any)` 方法或 Behaviour 组件 `onAwake(config?: any)` 方法的可选参数。
         */
        public getOrAddComponent<T extends BaseComponent>(componentClass: IComponentClass<T>, isExtends: boolean = false, config?: any) {
            return this.getComponent(componentClass, isExtends) || this.addComponent(componentClass, config);
        }
        /**
         * 向该实体已激活的全部 Behaviour 组件发送消息。
         * @param methodName 
         * @param parameter
         */
        public sendMessage<T extends Behaviour>(methodName: keyof T, parameter?: any, requireReceiver: boolean = true) {
            for (const component of this._components) {
                if (component && (component.constructor as IComponentClass<T>).__isBehaviour && component.isActiveAndEnabled) {
                    if (methodName in component) {
                        (component as any)[methodName](parameter);
                    }
                    else if (DEBUG && requireReceiver) {
                        console.warn(this.name, egret.getQualifiedClassName(component), methodName); // TODO
                    }
                }
            }
        }
        /**
         * 向该实体和其父级的 Behaviour 组件发送消息。
         * @param methodName 
         * @param parameter 
         */
        public sendMessageUpwards<T extends Behaviour>(methodName: keyof T, parameter?: any, requireReceiver: boolean = true) {
            this.sendMessage(methodName as any, parameter, requireReceiver);
            //
            const parent = this.transform.parent;
            if (parent && parent.gameObject.activeInHierarchy) {
                parent.gameObject.sendMessage(methodName as any, parameter, requireReceiver);
            }
        }
        /**
         * 向该实体和的其子（孙）级的 Behaviour 组件发送消息。
         * @param methodName 
         * @param parameter 
         */
        public broadcastMessage<T extends Behaviour>(methodName: keyof T, parameter?: any, requireReceiver: boolean = true) {
            this.sendMessage(methodName as any, parameter, requireReceiver);

            for (const child of this.transform.children) {
                if (child.gameObject.activeInHierarchy) {
                    child.gameObject.broadcastMessage(methodName as any, parameter, requireReceiver);
                }
            }
        }
        /**
         * 该实体是否已经被销毁。
         */
        public get isDestroyed() {
            return !this._scene;
        }
        /**
         * 该实体是否可以被销毁。
         * - 当此值为 `true` 时，将会被添加到全局场景，反之将被添加到激活场景。
         * - 设置此属性时，可能改变该实体的父级。
         */
        public get dontDestroy() {
            return this._scene === Scene.globalScene;
        }
        public set dontDestroy(value: boolean) {
            if (this.dontDestroy === value) {
                return;
            }

            if (this.transform.parent && this.transform.parent.gameObject.dontDestroy !== value) {
                this.transform.parent = null;
            }

            if (value) {
                this._addToScene(Scene.globalScene);
            }
            else {
                if (this === GameObject._globalGameObject) {
                    console.warn("Cannot change the `dontDestroy` value of the global game object.", this.name, this.uuid);
                    return;
                }

                this._addToScene(Scene.activeScene);
            }

            for (const child of this.transform.children) {
                child.gameObject.dontDestroy = value;
            }
        }
        /**
         * 该实体自身的激活状态。
         */
        @editor.property(editor.EditType.CHECKBOX)
        public get activeSelf() {
            return this._activeSelf;
        }
        public set activeSelf(value: boolean) {
            if (this._activeSelf === value || this === GameObject._globalGameObject) {
                return;
            }

            const parent = this.transform.parent;
            if (!parent || parent.gameObject.activeInHierarchy) {
                const prevActive = this._activeSelf;
                this._activeSelf = value;
                this._activeInHierarchyDirty(prevActive);
            }
            else {
                this._activeSelf = value;//TODO
            }
        }
        /**
         * 该实体在场景中的激活状态。
         */
        public get activeInHierarchy() {
            if (this._activeDirty) {
                const parent = this.transform.parent;

                if (!parent || parent.gameObject.activeInHierarchy) {
                    this._activeInHierarchy = this._activeSelf;
                }
                else {
                    this._activeInHierarchy = false;
                }

                this._activeDirty = false;
            }

            return this._activeInHierarchy;
        }
        /**
         * 该实体的路径。
         */
        public get path(): string {
            let path = this.name;

            if (this.transform) {
                let parent: egret3d.Transform | null = this.transform.parent;
                while (parent) {
                    path = parent.gameObject.name + "/" + path;
                    parent = parent.parent;
                }

                return this._scene!.name + "/" + path;
            }

            return path;
        }
        /**
         * 该实体已添加的全部组件。
         */
        @serializedField
        @deserializedIgnore
        public get components(): ReadonlyArray<BaseComponent> {
            this._cachedComponents.length = 0;

            for (const component of this._components) {
                if (!component) {
                    continue;
                }

                if (component.constructor === GroupComponent) {
                    for (const componentInGroup of (component as GroupComponent).components) {
                        this._cachedComponents.push(componentInGroup);
                    }
                }
                else {
                    this._cachedComponents.push(component);
                }
            }

            return this._cachedComponents;
        }
        /**
         * 该实体的父级实体。
         */
        public get parent() {
            return this.transform.parent ? this.transform.parent.gameObject : null;
        }
        public set parent(gameObject: GameObject | null) {
            this.transform.parent = gameObject ? gameObject.transform : null;
        }
        /**
         * 该实体所属的场景。
         */
        public get scene() {
            return this._scene!;
        }
        /**
         * 全局实体。
         * - 全局实体不可被销毁。
         * - 静态组件都会添加到全局实体上。
         */
        public get globalGameObject() {
            return GameObject.globalGameObject;
        }

        /**
         * @deprecated
         * @see paper.Scene#find()
         */
        public static find(name: string, scene: Scene | null = null) {
            return (scene || Application.sceneManager.activeScene).find(name);
        }
        /**
         * @deprecated
         * @see paper.Scene#findWithTag()
         */
        public static findWithTag(tag: string, scene: Scene | null = null) {
            return (scene || Application.sceneManager.activeScene).findWithTag(tag);
        }
        /**
         * @deprecated
         * @see paper.Scene#findGameObjectsWithTag()
         */
        public static findGameObjectsWithTag(tag: string, scene: Scene | null = null) {
            return (scene || Application.sceneManager.activeScene).findGameObjectsWithTag(tag);
        }
        /**
         * @deprecated
         */
        public static raycast(
            ray: Readonly<egret3d.Ray>, gameObjects: ReadonlyArray<GameObject>,
            maxDistance: number = 0.0, cullingMask: Layer = Layer.Everything, raycastMesh: boolean = false
        ) {
            return egret3d.raycastAll(ray, gameObjects, maxDistance, cullingMask, raycastMesh);
        }
    }
}
