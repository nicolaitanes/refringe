// NotesOverlay.js - Vue component for Notes overlay panel
import { defineComponent, ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { useNotes } from 'useNotes';

export default defineComponent({
    name: 'NotesOverlay',
    props: {
        proposalid: {
            type: [String, null],
            default: null
        },
        showid: {
            type: [String, null],
            default: null
        },
        userid: {
            type: [String, null],
            default: null
        },
        venueid: {
            type: [String, null],
            default: null
        },
        level: {
            type: [Number, String, null],
            default: 100
        }
    },
    emits: ['close'],
    setup(props, { emit }) {
        const { 
            notes, loading, error, showHidden, filteredNotes,
            loadNotes, createNote, toggleNoteFlag, deleteNote, formatTimestamp
        } = useNotes();
        
        const newNoteText = ref('');
        const textareaRef = ref(null);
        const notesListRef = ref(null);
        const overlayRef = ref(null);
        
        const contextType = computed(() => {
            if (props.showid) return 'show';
            if (props.proposalid) return 'proposal'; 
            if (props.userid) return 'user';
            if (props.venueid) return 'venue';
            return null;
        });
        
        const canCreateNotes = computed(() => {
            // Organizers and SuperUsers can always create notes
            if (props.level <= 10) {
                return true;
            }
            // Proposers can create notes on their own proposals/shows
            // (This would need server-side validation)
            // return currentUserRole.value === 'Proposer' && (props.proposalid || props.showid);
        });
        
        const newNoteVisibility = computed(() => {
            // Default visibility based on user role
            if (props.level > 10) {
                return {
                    is_visible_to_organizers: true,
                    is_visible_to_proposers: true,
                    is_visible_to_public: false
                };
            } else {
                return {
                    is_visible_to_organizers: true,
                    is_visible_to_proposers: false,
                    is_visible_to_public: false
                };
            }
        });

        // Methods
        function closeOverlay() {
            emit('close');
        }
        
        function handleBackdropClick(event) {
            if (event.target === overlayRef.value) {
                closeOverlay();
            }
        }
        
        function handleKeydown(event) {
            if (event.key === 'Escape') {
                closeOverlay();
            }
        }
        
        function switchTab(showHiddenTab) {
            showHidden.value = showHiddenTab;
            nextTick(() => {
                scrollToBottom();
            });
        }
        
        function scrollToBottom() {
            if (notesListRef.value) {
                notesListRef.value.scrollTop = notesListRef.value.scrollHeight;
            }
        }
        
        async function submitNote() {
            if (!newNoteText.value.trim() || !canCreateNotes.value) return;
            
            try {
                await createNote({
                    content: newNoteText.value.trim(),
                    ...newNoteVisibility.value
                });
                newNoteText.value = '';
                // Auto-switch to active tab after creating note
                if (showHidden.value) {
                    switchTab(false);
                } else {
                    scrollToBottom();
                }
            } catch (err) {
                console.error('Failed to create note:', err);
            }
        }
        
        function handleTextareaKeydown(event) {
            if (event.key === 'Enter') {
                if (event.ctrlKey || event.metaKey) {
                    // Ctrl/Cmd+Enter to submit
                    event.preventDefault();
                    submitNote();
                } else if (!event.shiftKey) {
                    // Enter to submit (unless Shift+Enter for new line)
                    event.preventDefault();
                    submitNote();
                }
            }
        }
        
        async function toggleFlag(noteid, flagName) {
            try {
                await toggleNoteFlag(noteid, flagName);
            } catch (err) {
                console.error('Failed to toggle flag:', err);
            }
        }
        
        async function removeNote(noteid) {
            if (confirm('Are you sure you want to delete this note?')) {
                try {
                    await deleteNote(noteid);
                } catch (err) {
                    console.error('Failed to delete note:', err);
                }
            }
        }
        
        function getVisibilityIcons(note) {
            const icons = [];
            if (note.is_visible_to_organizers) icons.push({ icon: '👥', tooltip: 'Visible to organizers' });
            if (note.is_visible_to_proposers) icons.push({ icon: '👤', tooltip: 'Visible to proposers' });
            if (note.is_visible_to_public) icons.push({ icon: '🌍', tooltip: 'Visible to public' });
            if (note.is_hidden) icons.push({ icon: '👁️‍🗨️', tooltip: 'Hidden note' });
            return icons;
        }

        // Lifecycle
        onMounted(async () => {
            document.addEventListener('keydown', handleKeydown);
            await loadNotes(contextType.value, props);
        });
        
        onUnmounted(() => {
            document.removeEventListener('keydown', handleKeydown);
        });
        
        // Watch for tab changes to scroll to bottom
        watch(showHidden, () => {
            nextTick(() => {
                scrollToBottom();
            });
        });

        return {
            notes,
            loading,
            error,
            showHidden,
            filteredNotes,
            newNoteText,
            textareaRef,
            notesListRef,
            overlayRef,
            canCreateNotes,
            closeOverlay,
            handleBackdropClick,
            switchTab,
            submitNote,
            handleTextareaKeydown,
            toggleFlag,
            removeNote,
            formatTimestamp,
            getVisibilityIcons
        };
    },
    template: `
        <div 
            ref="overlayRef"
            @click="handleBackdropClick"
            style="
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: rgba(0,0,0,0.5);
                z-index: 1000;
                display: flex;
                align-items: stretch;
                justify-content: flex-end;
            "
        >
            <div 
                style="
                    width: 400px;
                    max-width: 90vw;
                    background: var(--bg, white);
                    color: var(--fg, black);
                    box-shadow: -2px 0 10px rgba(0,0,0,0.3);
                    display: flex;
                    flex-direction: column;
                    animation: slideInRight 0.3s ease-out;
                "
            >
                <!-- Header -->
                <div style="
                    padding: 1rem;
                    border-bottom: 1px solid #eee;
                    background: var(--menu-bg, #f8f9fa);;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                ">
                    <h3 style="margin: 0; font-size: 1.1rem;">
                        Notes
                        <span v-if="proposalid && showid" style="color: var(--fg, #666); font-size: 0.8rem;">
                            (Show & Proposal)
                        </span>
                        <span v-else-if="showid" style="color: var(--fg, #666); font-size: 0.8rem;">
                            (Show)
                        </span>
                        <span v-else-if="proposalid" style="color: var(--fg, #666); font-size: 0.8rem;">
                            (Proposal)
                        </span>
                        <span v-else-if="userid" style="color: var(--fg, #666); font-size: 0.8rem;">
                            (User)
                        </span>
                        <span v-else-if="proposalid" style="color: var(--fg, #666); font-size: 0.8rem;">
                            (Venue)
                        </span>
                    </h3>
                    <button 
                        @click="closeOverlay"
                        style="
                            background: none;
                            border: none;
                            font-size: 1.2rem;
                            cursor: pointer;
                            color: var(--fg, #666);
                            padding: 0.25rem;
                        "
                    >
                        ✕
                    </button>
                </div>

                <!-- Tabs -->
                <div style="
                    display: flex;
                    border-bottom: 1px solid #eee;
                    background: #f8f9fa;
                ">
                    <button
                        @click="switchTab(false)"
                        :style="{
                            flex: 1,
                            padding: '0.75rem',
                            border: 'none',
                            background: !showHidden ? '#007cba' : 'transparent',
                            color: !showHidden ? 'var(--bg, white)' : 'var(--fg, #666)',
                            cursor: 'pointer',
                            fontSize: '0.9rem'
                        }"
                    >
                        Active Notes
                    </button>
                    <button
                        @click="switchTab(true)"
                        :style="{
                            flex: 1,
                            padding: '0.75rem', 
                            border: 'none',
                            background: showHidden ? '#007cba' : 'transparent',
                            color: showHidden ? 'var(--bg, white)' : 'var(--fg, #666)',
                            cursor: 'pointer',
                            fontSize: '0.9rem'
                        }"
                    >
                        Hidden Notes
                    </button>
                </div>

                <!-- Notes List -->
                <div 
                    ref="notesListRef"
                    style="
                        flex: 1;
                        overflow-y: auto;
                        padding: 0.5rem;
                        min-height: 300px;
                        max-height: 400px;
                    "
                >
                    <div v-if="loading" style="text-align: center; padding: 2rem; color: var(--fg, #666);">
                        Loading notes...
                    </div>
                    
                    <div v-else-if="error" style="text-align: center; padding: 2rem; color: #d32f2f;">
                        Error: {{ error }}
                    </div>
                    
                    <div v-else-if="filteredNotes.length === 0" style="text-align: center; padding: 2rem; color: var(--fg, #666);">
                        No {{ showHidden ? 'hidden' : 'active' }} notes
                    </div>

                    <div v-else>
                        <div
                            v-for="note in filteredNotes"
                            :key="note.id"
                            style="
                                margin-bottom: 1rem;
                                padding: 0.75rem;
                                background: var(--bg, #f8f9fa);
                                border-radius: 8px;
                                border-left: 3px solid #007cba;
                            "
                        >
                            <!-- Note header -->
                            <div style="
                                display: flex;
                                justify-content: space-between;
                                align-items: center;
                                margin-bottom: 0.5rem;
                                font-size: 0.8rem;
                                color: var(--fg, #666);
                            ">
                                <span>
                                    {{ note.first_name }} {{ note.last_name }}
                                    • {{ formatTimestamp(note.created) }}
                                </span>
                                <div style="display: flex; gap: 0.25rem;">
                                    <span 
                                        v-for="vis in getVisibilityIcons(note)"
                                        :key="vis.icon"
                                        :title="vis.tooltip"
                                        style="cursor: help;"
                                    >
                                        {{ vis.icon }}
                                    </span>
                                </div>
                            </div>
                            
                            <!-- Note content -->
                            <div style="
                                white-space: pre-wrap;
                                line-height: 1.4;
                                margin-bottom: 0.5rem;
                            ">
                                {{ note.content }}
                            </div>
                            
                            <!-- Note actions -->
                            <div style="
                                display: flex;
                                gap: 0.5rem;
                                font-size: 0.8rem;
                            ">
                            <!--
                                <button 
                                    @click="toggleFlag(note.id, 'is_visible_to_organizers')"
                                    :style="{
                                        background: note.is_visible_to_organizers ? '#007cba' : '#ccc',
                                        color: note.is_visible_to_organizers ? 'var(--bg, white)' : 'var(--fg, #666)',
                                        border: 'none',
                                        padding: '0.25rem 0.5rem',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontSize: '0.7rem'
                                    }"
                                    title="Toggle organizer visibility"
                                >
                                    👥
                                </button>
                            -->
                                <button 
                                    @click="toggleFlag(note.id, 'is_visible_to_proposers')"
                                    :style="{
                                        background: note.is_visible_to_proposers ? '#007cba' : '#ccc',
                                        color: note.is_visible_to_proposers ? 'var(--bg, white)' : 'var(--fg, #666)',
                                        border: 'none',
                                        padding: '0.25rem 0.5rem',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontSize: '0.7rem'
                                    }"
                                    title="Toggle proposer visibility"
                                >
                                    👤
                                </button>
                                <button 
                                    @click="toggleFlag(note.id, 'is_visible_to_public')"
                                    :style="{
                                        background: note.is_visible_to_public ? '#007cba' : '#ccc',
                                        color: note.is_visible_to_public ? 'var(--bg, white)' : 'var(--fg, #666)',
                                        border: 'none',
                                        padding: '0.25rem 0.5rem',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontSize: '0.7rem'
                                    }"
                                    title="Toggle public visibility"
                                >
                                    🌍
                                </button>
                                <button 
                                    @click="toggleFlag(note.id, 'is_hidden')"
                                    :style="{
                                        background: note.is_hidden ? '#ffa726' : '#ccc',
                                        color: note.is_hidden ? 'var(--bg, white)' : 'var(--fg, #666)',
                                        border: 'none',
                                        padding: '0.25rem 0.5rem',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontSize: '0.7rem'
                                    }"
                                    title="Toggle hidden status"
                                >
                                    {{ note.is_hidden ? '👁️‍🗨️' : '🚫' }}
                                </button>
                                <button
                                    v-if="note.is_hidden"
                                    @click="removeNote(note.id)"
                                    style="
                                        background: #d32f2f;
                                        color: var(--bg, white);
                                        border: none;
                                        padding: 0.25rem 0.5rem;
                                        border-radius: 4px;
                                        cursor: pointer;
                                        font-size: 0.7rem;
                                        margin-left: auto;
                                    "
                                    title="Delete note"
                                >
                                    🗑️
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- New Note Input -->
                <div 
                    v-if="canCreateNotes"
                    style="
                        padding: 1rem;
                        border-top: 1px solid #eee;
                        background: var(--bg, #f8f9fa);
                    "
                >
                    <textarea
                        ref="textareaRef"
                        v-model="newNoteText"
                        @keydown="handleTextareaKeydown"
                        placeholder="Type a note... (Enter to send, Shift+Enter for new line)"
                        style="
                            width: 100%;
                            min-height: 60px;
                            max-height: 120px;
                            border: 1px solid #ddd;
                            border-radius: 4px;
                            padding: 0.5rem;
                            font-family: inherit;
                            font-size: 0.9rem;
                            resize: vertical;
                            margin-bottom: 0.5rem;
                        "
                    ></textarea>
                    <div style="
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    ">
                        <small style="color: var(--fg, #666);">
                            Enter to send • Shift+Enter for new line
                        </small>
                        <button
                            @click="submitNote"
                            :disabled="!newNoteText.trim()"
                            style="
                                background: var(--fg, #007cba);
                                color: var(--bg, white);
                                border: none;
                                padding: 0.5rem 1rem;
                                border-radius: 4px;
                                cursor: pointer;
                                font-size: 0.9rem;
                            "
                            :style="{ opacity: newNoteText.trim() ? 1 : 0.5 }"
                        >
                            Send
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `
});
