/// <reference path="../base/utils.ts" />
/// <reference path="../base/geom.ts" />
/// <reference path="../base/entity.ts" />
/// <reference path="../base/text.ts" />
/// <reference path="../base/scene.ts" />
/// <reference path="../base/app.ts" />

///  game.ts
///


//  Initialize the resources.
let FONT: Font;
let SPRITES:SpriteSheet;
addInitHook(() => {
    FONT = new Font(APP.images['font'], 'white');
    SPRITES = new ArraySpriteSheet([
	new RectSprite('pink', new Rect(-20,-5,40,10)),
        new RectSprite('white', new Rect(-5,-5,10,10)),

        new RectSprite('purple', new Rect(-20,-5,40,10)),
        new RectSprite('cyan', new Rect(-20,-5,40,10)),
        new RectSprite('orange', new Rect(-20,-5,40,10)),
        new RectSprite('gray', new Rect(-20,-5,40,10)),
        new RectSprite('yellow', new Rect(-20,-5,40,10)),
        new RectSprite('green', new Rect(-20,-5,40,10)),
    ]);
});


//  Paddle
//
class Paddle extends Entity {

    usermove: Vec2 = new Vec2();

    constructor(pos: Vec2) {
	super(pos);
        let sprite = SPRITES.get(0);
	this.sprites = [sprite];
	this.collider = sprite.getBounds();
    }

    onTick() {
	super.onTick();
	this.moveIfPossible(this.usermove);
    }

    setMove(v: Vec2) {
	this.usermove.x = v.x * 8;
    }

    getFencesFor(range: Rect, v: Vec2, context: string): Rect[] {
	return [this.world.area];
    }
}


//  Ball
//
class Ball extends Entity {

    vx: number = +1;

    constructor(pos: Vec2) {
	super(pos);
        let sprite = SPRITES.get(1);
	this.sprites = [sprite];
	this.collider = sprite.getBounds();
    }

    onTick() {
	super.onTick();
        let v = new Vec2(this.vx*rnd(8), 0);
        if (!this.canMove(v)) {
            this.vx = -this.vx;
            v.x = -v.x;
        }
	this.movePos(v);
    }

    getFencesFor(range: Rect, v: Vec2, context: string): Rect[] {
	return [this.world.area];
    }
}


//  Brick
//
class Brick extends Entity {

    origin: Vec2;
    falling: number = 0;  // 0:stop, 1:falling, 2:bouncing
    movement: Vec2 = new Vec2();
    scored: Signal;

    constructor(pos: Vec2, i: number) {
	super(pos);
        let sprite = SPRITES.get(2+i);
	this.sprites = [sprite];
	this.collider = sprite.getBounds();
        this.scored = new Signal(this);
        this.origin = pos.copy();
    }

    fall() {
        this.falling = 1;
        this.order = +1;
        this.world.sortEntitiesByOrder();
        this.movement = new Vec2();
        APP.playSound('drop');
    }

    onTick() {
	super.onTick();
        switch (this.falling) {
        case 1:
            this.movement.y = Math.min(8, this.movement.y+1);
            this.movePos(this.movement);
            break;
        case 2:
            let b = this.world.area;
            let c = this.getCollider(this.pos.add(this.movement)) as Rect;
            if (c.x < b.x || b.x1() < c.x1()) {
                this.movement.x = -this.movement.x;
            }
            if (c.y < b.y) {
                this.movement.y = Math.abs(this.movement.y);
            }
            this.movePos(this.movement);
            c = this.getCollider() as Rect;
            if (c.containsPt(this.origin)) {
                this.pos = this.origin.copy();
                this.falling = 0;
                this.order = 0;
                this.world.sortEntitiesByOrder();
            }
        }
        if (!this.world.area.overlaps(this.getCollider())) {
            APP.playSound('fail');
            this.stop();
        }
    }

    onCollided(entity: Entity) {
        if (entity instanceof Ball) {
            APP.playSound('score');
            this.scored.fire();
            this.stop();
        } else if (entity instanceof Paddle) {
            APP.playSound('bounce');
            this.movement.x = int((this.pos.x - entity.pos.x)/4);
            this.movement.y = -Math.abs(this.movement.y);
            this.falling = 2;
        }
    }
}


//  Game
//
class Game extends GameScene {

    paddle: Paddle;
    ball: Ball;
    bricks: Brick[];
    nextTick: number;
    scoreBox: TextBox;
    score: number;

    onStart() {
	super.onStart();
        let area = this.screen.resize(40*6,200);
        this.world.area = area;
	this.scoreBox = new TextBox(this.screen.inflate(-2,-2), FONT);
	this.paddle = new Paddle(this.world.area.anchor('s'));
	this.add(this.paddle);
	this.ball = new Ball(this.world.area.center().move(0,20));
	this.add(this.ball);

        this.bricks = [];
        for (let y = 0; y < 6; y++) {
            for (let x = 0; x < 6; x++) {
                let p = new Vec2(x*40+20+area.x, y*15+10+area.y);
                let brick = new Brick(p, y);
                brick.stopped.subscribe(() => {
                    removeElement(this.bricks, brick);
                    if (this.bricks.length == 0) {
                        this.gameOver();
                    }
                });
                brick.scored.subscribe(() => {
                    this.score++;
                    this.updateScore();
                });
                this.bricks.push(brick);
                this.add(brick);
            }
        }

        this.nextTick = this.world.getTime()+2;
	this.score = 0;
	this.updateScore();
    }

    onTick() {
	super.onTick();
        let t = this.world.getTime();
        if (0 < this.bricks.length && this.nextTick < t) {
            let brick = choice(this.bricks);
            brick.fall();
            this.nextTick = t+rnd(1,3);
        }
    }

    onDirChanged(v: Vec2) {
	this.paddle.setMove(v);
    }

    onMouseMove(p: Vec2) {
        this.paddle.setMove(p.sub(this.paddle.pos).sign());
    }

    gameOver() {
	let banner = new BannerBox(this.world.area, FONT, ['GAME OVER!']);
	this.world.add(banner);
        let task = new Task();
        task.lifetime = 3;
        task.stopped.subscribe(() => { this.reset(); });
        this.world.add(task);
    }

    render(ctx: CanvasRenderingContext2D) {
	ctx.fillStyle = 'rgb(0,0,0)';
	fillRect(ctx, this.screen);
	ctx.fillStyle = 'white';
        fillRect(ctx, this.world.area.inflate(5,0).move(0,-5));
	ctx.fillStyle = 'black';
        fillRect(ctx, this.world.area);
	super.render(ctx);
	this.scoreBox.render(ctx);
    }

    updateScore() {
	this.scoreBox.clear();
	this.scoreBox.putText(['SCORE: '+this.score]);
    }
}
