namespace paper.editor {
    export class zAxis extends BaseGeo {
        constructor() {
            super();
        }
        onSet() {
            let zAxis = this._createAxis(new egret3d.Vector4(0.0, 0.0, 1, 1), 0);
            zAxis.name = "GizmoController_Z";
            zAxis.tag = "Editor";
            zAxis.transform.setLocalScale(0.1, 2, 0.1);
            zAxis.transform.setLocalEulerAngles(90, 0, 0);
            zAxis.transform.setLocalPosition(0, 0, 1);
            this.geo = zAxis
        }
        wasPressed_local(ray: egret3d.Ray, selectedGameObjs: any) {
            this.canDrag = true
            let worldRotation = selectedGameObjs[0].transform.getRotation();
            let worldPosition = selectedGameObjs[0].transform.getPosition();
            egret3d.Vector3.copy(worldPosition, this._dragPlanePoint);

            let pos = Application.sceneManager.editorScene.find("EditorCamera").transform.getPosition()
            let normal = new egret3d.Vector3(pos.x + pos.y, pos.x + pos.y, 0)

            this._dragPlaneNormal.applyQuaternion(worldRotation, normal);
            this._dragOffset = ray.intersectPlane(this._dragPlanePoint, this._dragPlaneNormal);
            egret3d.Vector3.subtract(this._dragOffset, worldPosition, this._dragOffset);
        }
        isPressed_local(ray: egret3d.Ray, selectedGameObjs: any) {
            let worldRotation = selectedGameObjs[0].transform.getRotation();
            let worldPosition = selectedGameObjs[0].transform.getPosition();

            let hit = ray.intersectPlane(this._dragPlanePoint, this._dragPlaneNormal);
            egret3d.Vector3.subtract(hit, this._dragOffset, hit);
            egret3d.Vector3.subtract(hit, worldPosition, hit);
            let worldOffset = new egret3d.Vector3;
            worldOffset.applyQuaternion(worldRotation, this.forward);
            let cosHit = egret3d.Vector3.dot(hit, worldOffset);
            egret3d.Vector3.scale(worldOffset, cosHit);
            let position = egret3d.Vector3.add(worldPosition, worldOffset, this.helpVec3_2);
            egret3d.Vector3.copy(position, this._ctrlPos);
            let parentMatrix = selectedGameObjs[0].transform.parent.getWorldMatrix()
            parentMatrix = parentMatrix.inverse()
            parentMatrix.transformNormal(position)
            this.editorModel.setTransformProperty("localPosition", position, selectedGameObjs[0].transform);

        }
        wasPressed_world(ray: egret3d.Ray, selectedGameObjs: any) {
            egret3d.Vector3.set(0, 0, 0, this._dragOffset);
            let len = selectedGameObjs.length;
            let ctrlPos = egret3d.Vector3.set(0, 0, 0, this._ctrlPos);
            for (let i = 0; i < len; i++) {
                let obj = selectedGameObjs[i];
                egret3d.Vector3.add(obj.transform.getPosition(), ctrlPos, ctrlPos);
            }
            ctrlPos = egret3d.Vector3.scale(ctrlPos, 1 / len);
            egret3d.Vector3.copy(ctrlPos, this._dragPlanePoint);
            egret3d.Vector3.copy(this.up, this._dragPlaneNormal);

            let pos = Application.sceneManager.editorScene.find("EditorCamera").transform.getPosition()
            let normal = new egret3d.Vector3(pos.x + pos.y, pos.x + pos.y, 0)

            this._dragOffset = ray.intersectPlane(this._dragPlanePoint, normal);

        }
        isPressed_world(ray: egret3d.Ray, selectedGameObjs: any) {
            let len = selectedGameObjs.length;
            let hit = ray.intersectPlane(this._dragPlanePoint, this._dragPlaneNormal);
            egret3d.Vector3.subtract(hit, this._dragOffset, this._delta);
            let worldOffset = new egret3d.Vector3;
            worldOffset = egret3d.Vector3.copy(this.forward, this.helpVec3_1);
            let cosHit = egret3d.Vector3.dot(this._delta, worldOffset);
            egret3d.Vector3.scale(worldOffset, cosHit);
            egret3d.Vector3.add(this._ctrlPos, worldOffset, this._ctrlPos);
            for (let i = 0; i < len; i++) {
                let obj = selectedGameObjs[i];
                let lastPos = obj.transform.getPosition();
                egret3d.Vector3.add(lastPos, worldOffset, this._newPosition);

                let parentMatrix = obj.transform.parent.getWorldMatrix()
                parentMatrix = parentMatrix.inverse()
                parentMatrix.transformNormal(this._newPosition)

                this.editorModel.setTransformProperty("localPosition", this._newPosition, obj.transform);
            }
            egret3d.Vector3.copy(hit, this._dragOffset);

        }
        wasReleased() { return }


    }
}