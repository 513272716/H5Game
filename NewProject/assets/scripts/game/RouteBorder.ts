import {
    _decorator,
    Color,
    Component,
    Graphics,
    UITransform,
} from 'cc';

const { ccclass } = _decorator;

/** Draws the editable walkable rectangle; falls back to child waypoints for legacy routes. */
@ccclass('RouteBorder')
export default class RouteBorder extends Component {
    redraw(): void {
        const graphics = this.node.getComponent(Graphics) || this.node.addComponent(Graphics);
        graphics.clear();
        graphics.lineWidth = 6;
        graphics.strokeColor = new Color(241, 79, 79, 210);
        const transform = this.node.getComponent(UITransform);
        if (transform && transform.width > 0 && transform.height > 0) {
            const left = -transform.width * transform.anchorPoint.x;
            const bottom = -transform.height * transform.anchorPoint.y;
            graphics.rect(left, bottom, transform.width, transform.height);
            graphics.stroke();
            return;
        }

        const points = this.node.children;
        if (points.length < 2) return;
        graphics.moveTo(points[0].position.x, points[0].position.y);
        for (let index = 1; index < points.length; index += 1) {
            graphics.lineTo(points[index].position.x, points[index].position.y);
        }
        graphics.stroke();
    }

    onLoad(): void {
        this.redraw();
    }
}
