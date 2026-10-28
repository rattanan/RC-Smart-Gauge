package com.rcvision.render

import android.content.Context
import android.opengl.GLES20.*
import android.opengl.GLSurfaceView
import android.opengl.Matrix
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer
import javax.microedition.khronos.egl.EGLConfig
import javax.microedition.khronos.opengles.GL10
import kotlin.math.*

class ChaseScene(context: Context) : GLSurfaceView(context) {
    val scene = ChaseRenderer()
    init { setEGLContextClientVersion(2); setRenderer(scene); renderMode = RENDERMODE_CONTINUOUSLY }
}

/** Owned procedural meshes. Perspective, depth buffer, camera and animated transforms. */
class ChaseRenderer : GLSurfaceView.Renderer {
    @Volatile var steering = 0f
    @Volatile var elapsed = 0f
    private var program = 0
    private val vp = FloatArray(16)
    private val model = FloatArray(16)
    private val mvp = FloatArray(16)
    private val cube = floatArrayOf(
        -1f,-1f,1f, 1f,-1f,1f, 1f,1f,1f, -1f,-1f,1f, 1f,1f,1f, -1f,1f,1f,
        1f,-1f,-1f, -1f,-1f,-1f, -1f,1f,-1f, 1f,-1f,-1f, -1f,1f,-1f, 1f,1f,-1f,
        -1f,-1f,-1f, -1f,-1f,1f, -1f,1f,1f, -1f,-1f,-1f, -1f,1f,1f, -1f,1f,-1f,
        1f,-1f,1f, 1f,-1f,-1f, 1f,1f,-1f, 1f,-1f,1f, 1f,1f,-1f, 1f,1f,1f,
        -1f,1f,1f, 1f,1f,1f, 1f,1f,-1f, -1f,1f,1f, 1f,1f,-1f, -1f,1f,-1f,
        -1f,-1f,-1f, 1f,-1f,-1f, 1f,-1f,1f, -1f,-1f,-1f, 1f,-1f,1f, -1f,-1f,1f)
    private val cubeBuffer = ByteBuffer.allocateDirect(cube.size*4).order(ByteOrder.nativeOrder()).asFloatBuffer().put(cube).also { it.position(0) }
    private fun buffer(values: FloatArray) = ByteBuffer.allocateDirect(values.size*4).order(ByteOrder.nativeOrder()).asFloatBuffer().put(values).also { it.position(0) }
    private val cabinBuffer = buffer(cube.copyOf().also { vertices ->
        for(i in vertices.indices step 3) if(vertices[i+1]>0) { vertices[i]*=0.82f; vertices[i+2]=vertices[i+2]*0.68f-0.08f }
    })
    private val wheelBuffer = buffer(buildList<Float> {
        for(i in 0 until 20) {
            val a=i*2*PI/20; val b=(i+1)*2*PI/20
            val ay=cos(a).toFloat(); val az=sin(a).toFloat(); val by=cos(b).toFloat(); val bz=sin(b).toFloat()
            addAll(listOf(-1f,ay,az, 1f,ay,az, 1f,by,bz, -1f,ay,az, 1f,by,bz, -1f,by,bz))
            for(side in listOf(-1f,1f)) addAll(listOf(side,0f,0f, side,ay,az, side,by,bz))
        }
    }.toFloatArray())
    private fun center(z: Float) = (sin((-z)/17.0)*5).toFloat()
    private fun ribbon(left: Float,right: Float,y: Float): FloatBuffer = buffer(buildList<Float> {
        for(i in 0..180) {
            val z=10f-i*0.5f; val next=z-0.5f
            addAll(listOf(center(z)+left,y,z,center(z)+right,y,z,center(next)+right,y,next,
                center(z)+left,y,z,center(next)+right,y,next,center(next)+left,y,next))
        }
    }.toFloatArray())
    private val roadBuffer = ribbon(-5.3f,5.3f,-0.12f)
    private val leftEdgeBuffer = ribbon(-5f,-4.86f,-0.10f)
    private val rightEdgeBuffer = ribbon(4.86f,5f,-0.10f)
    private var positionLocation = 0
    private var matrixLocation = 0
    private var colorLocation = 0
    override fun onSurfaceCreated(gl: GL10?, config: EGLConfig?) {
        fun shader(type: Int, source: String): Int = glCreateShader(type).also { glShaderSource(it, source); glCompileShader(it) }
        program = glCreateProgram()
        glAttachShader(program, shader(GL_VERTEX_SHADER, "attribute vec3 position; uniform mat4 mvp; varying float shade; void main(){gl_Position=mvp*vec4(position,1.0);shade=0.82+0.18*position.y;}"))
        glAttachShader(program, shader(GL_FRAGMENT_SHADER, "precision mediump float; uniform vec4 color; varying float shade; void main(){gl_FragColor=vec4(color.rgb*shade,color.a);}"))
        glLinkProgram(program)
        positionLocation = glGetAttribLocation(program,"position")
        matrixLocation = glGetUniformLocation(program,"mvp")
        colorLocation = glGetUniformLocation(program,"color")
        glEnable(GL_DEPTH_TEST); glClearColor(0.98f,0.99f,1f,1f)
    }
    override fun onSurfaceChanged(gl: GL10?, width: Int, height: Int) {
        glViewport(0,0,width,height)
        val projection = FloatArray(16); val view = FloatArray(16)
        Matrix.perspectiveM(projection,0,48f,width.toFloat()/height,0.1f,140f)
        Matrix.setLookAtM(view,0,3.7f,4.8f,8.6f,0f,0f,-5f,0f,1f,0f)
        Matrix.multiplyMM(vp,0,projection,0,view,0)
    }
    private fun mesh(vertices: FloatBuffer, color: FloatArray) {
        glEnableVertexAttribArray(positionLocation); glVertexAttribPointer(positionLocation,3,GL_FLOAT,false,0,vertices)
        Matrix.multiplyMM(mvp,0,vp,0,model,0)
        glUniformMatrix4fv(matrixLocation,1,false,mvp,0)
        glUniform4fv(colorLocation,1,color,0)
        glDrawArrays(GL_TRIANGLES,0,vertices.capacity()/3)
    }
    private fun box(x: Float,y: Float,z: Float,sx: Float,sy: Float,sz: Float,color: FloatArray, yaw: Float = 0f, geometry: FloatBuffer = cubeBuffer) {
        Matrix.setIdentityM(model,0); Matrix.translateM(model,0,x,y,z); Matrix.rotateM(model,0,yaw,0f,1f,0f); Matrix.scaleM(model,0,sx,sy,sz); mesh(geometry,color)
    }
    private val white = floatArrayOf(0.98f,0.99f,1f,1f)
    private val dark = floatArrayOf(0.035f,0.065f,0.085f,1f)
    private val cyan = floatArrayOf(0f,0.85f,0.94f,1f)
    private fun car(x: Float,z: Float,body: FloatArray,yaw: Float) {
        // Local parts are rotated about one car root, preserving wheel/body alignment.
        fun part(px: Float,py: Float,pz: Float,sx: Float,sy: Float,sz: Float,c: FloatArray, geometry: FloatBuffer = cubeBuffer) {
            val a = yaw*PI.toFloat()/180
            box(x+px*cos(a)+pz*sin(a),py,z-px*sin(a)+pz*cos(a),sx,sy,sz,c,yaw,geometry)
        }
        part(0f,0.2f,0f,1.16f,0.13f,2.25f,dark)
        part(0f,0.58f,0f,1.12f,0.35f,2.15f,body)
        part(0f,1.02f,-0.15f,0.99f,0.36f,1.3f,dark,cabinBuffer)
        part(0f,1.37f,-0.25f,0.83f,0.06f,0.9f,body)
        for (side in listOf(-1f,1f)) {
            for (axle in listOf(-1.35f,1.35f)) {
                part(side*1.12f,0.38f,axle,0.19f,0.40f,0.40f,dark,wheelBuffer)
                part(side*1.32f,0.38f,axle,0.015f,0.27f,0.27f,floatArrayOf(0.22f,0.28f,0.32f,1f),wheelBuffer)
                part(side*1.34f,0.38f,axle,0.018f,0.12f,0.12f,dark,wheelBuffer)
            }
            part(side*0.7f,0.66f,2.16f,0.31f,0.07f,0.025f,floatArrayOf(1f,0.08f,0.14f,1f))
            part(side*0.76f,1.05f,1.75f,0.035f,0.32f,0.05f,dark)
            part(side*1.13f,0.43f,0f,0.02f,0.05f,0.75f,cyan)
        }
        part(0f,1.37f,1.76f,1.3f,0.07f,0.3f,dark)
        part(-0.55f,0.25f,2.23f,0.21f,0.1f,0.1f,dark)
    }
    override fun onDrawFrame(gl: GL10?) {
        glClear(GL_COLOR_BUFFER_BIT or GL_DEPTH_BUFFER_BIT); glUseProgram(program)
        box(0f,-0.25f,-30f,70f,0.1f,90f,white)
        Matrix.setIdentityM(model,0); mesh(roadBuffer,floatArrayOf(0.71f,0.75f,0.80f,1f))
        mesh(leftEdgeBuffer,white); mesh(rightEdgeBuffer,white)
        car(center(-15f)+sin(elapsed/5f),-15f,floatArrayOf(0.95f,0.15f,0.12f,1f),-12f)
        car(0f,1f,white,steering*-12f)
        box(-5.8f,0.8f,-8f,0.06f,0.8f,0.06f,dark)
        box(-7.6f,0.8f,-8f,0.06f,0.8f,0.06f,dark)
        box(-6.7f,1.8f,-8f,1.2f,0.45f,0.08f,white)
        // Small block lettering on the symbolic sign; no externally licensed asset.
        val glyphs = listOf(listOf("111","100","111","001","111"), listOf("111","010","010","010","010"), listOf("010","101","111","101","101"), listOf("110","101","110","101","101"), listOf("111","010","010","010","010"))
        glyphs.forEachIndexed { letter, rows -> rows.forEachIndexed { row, cells -> cells.forEachIndexed { col, pixel ->
            if(pixel == '1') box(-7.75f+letter*0.43f+col*0.1f,2.06f-row*0.12f,-7.90f,0.046f,0.052f,0.015f,dark)
        } } }
    }
}
