'use client';

import React, { useState } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  addEdge, 
  MiniMap, 
  Connection, 
  Edge, 
  Node,
  useNodesState,
  useEdgesState 
} from 'reactflow';
import 'reactflow/dist/style.css';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Save, Play, Download } from 'lucide-react';

const initialNodes: Node[] = [
  { 
    id: 'manual', 
    position: { x: 0, y: 0 }, 
    data: { label: 'Manual Trigger' }, 
    type: 'input' 
  },
  { 
    id: 'http', 
    position: { x: 280, y: 0 }, 
    data: { label: 'HTTP Request' }, 
    type: 'default' 
  },
];

const initialEdges: Edge[] = [];

export default function NewFlowPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [name, setName] = useState('RP9 – Demo Flow');
  const [saving, setSaving] = useState(false);

  const onConnect = (connection: Connection) => {
    setEdges((eds) => addEdge(connection, eds));
  };

  function toN8nJSON() {
    const nodeById: Record<string, any> = {};
    
    for (const n of nodes) {
      if (n.id === 'manual') {
        nodeById[n.id] = {
          id: '1',
          name: 'Manual Trigger',
          type: 'n8n-nodes-base.manualTrigger',
          typeVersion: 1,
          position: [n.position.x, n.position.y],
          parameters: {}
        };
      }
      if (n.id === 'http') {
        nodeById[n.id] = {
          id: '2',
          name: 'HTTP Request',
          type: 'n8n-nodes-base.httpRequest',
          typeVersion: 4,
          position: [n.position.x, n.position.y],
          parameters: {
            url: 'https://httpbin.org/get',
            method: 'GET'
          }
        };
      }
    }

    const connections: any = {};
    for (const e of edges) {
      const src = nodeById[e.source]?.name;
      const tgt = nodeById[e.target]?.name;
      if (!src || !tgt) continue;
      
      connections[src] = connections[src] || { main: [[]] };
      connections[src].main[0].push({ 
        node: tgt, 
        type: 'main', 
        index: 0 
      });
    }

    return {
      name,
      active: false,
      nodes: Object.values(nodeById),
      connections,
      settings: {
        saveDataErrorExecution: 'all'
      }
    };
  }

  async function save() {
    try {
      setSaving(true);
      const workflow = toN8nJSON();
      
      // First check if workflow exists by name
      const listResponse = await axios.get('/.netlify/functions/n8n-proxy/workflows', {
        params: { limit: 250 }
      });
      
      const existing = listResponse.data?.data?.find((w: any) => w.name === workflow.name);
      
      let response;
      if (existing) {
        // Update existing workflow
        response = await axios.patch(`/.netlify/functions/n8n-proxy/workflows/${existing.id}`, workflow);
      } else {
        // Create new workflow
        response = await axios.post('/.netlify/functions/n8n-proxy/workflows', workflow);
      }
      
      alert('Workflow created/updated successfully: ' + (response.data?.id || 'ok'));
    } catch (error: any) {
      alert('Error saving workflow: ' + (error?.response?.data?.error || error.message));
    } finally {
      setSaving(false);
    }
  }

  function exportJSON() {
    const workflow = toN8nJSON();
    const blob = new Blob([JSON.stringify(workflow, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.toLowerCase().replace(/\s+/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <Card className="mx-4 mt-4 mb-0 rounded-b-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Workflow Builder</CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <div className="flex gap-3 items-center">
            <Input 
              className="flex-1 max-w-md" 
              value={name} 
              onChange={(e) => setName(e.target.value)}
              placeholder="Workflow name"
            />
            <Button 
              onClick={save} 
              disabled={saving}
              className="flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save to n8n'}
            </Button>
            <Button 
              onClick={exportJSON} 
              variant="outline"
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export JSON
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* React Flow Canvas */}
      <div className="flex-1 mx-4 mb-4">
        <Card className="h-full rounded-t-none">
          <CardContent className="p-0 h-full">
            <div className="h-full rounded-lg overflow-hidden border">
              <ReactFlow 
                nodes={nodes} 
                edges={edges} 
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange} 
                onConnect={onConnect}
                className="bg-gray-50 dark:bg-gray-900"
                fitView
                fitViewOptions={{ padding: 0.2 }}
              >
                <MiniMap 
                  className="bg-white dark:bg-gray-800 border"
                  nodeColor={(node) => {
                    switch (node.type) {
                      case 'input': return '#10b981';
                      case 'output': return '#ef4444';
                      default: return '#6366f1';
                    }
                  }}
                />
                <Controls className="bg-white dark:bg-gray-800" />
                <Background color="#aaa" gap={16} />
              </ReactFlow>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}